import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmailService } from 'src/config/service/email.service';
import {
    ChangePasswordDto,
    RequestPasswordResetDto,
    ResetPasswordDto,
} from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { User } from './entities/user.entity';
import { AuthResponse, TokenPayload, UserResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(PasswordResetToken)
        private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
        private readonly emailService: EmailService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Register a new user
     */
    async signup(signupDto: SignupDto): Promise<AuthResponse> {
        const { email, password, name } = signupDto;

        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const user = this.userRepository.create({
            email,
            name,
            password,
        });

        await user.hashPassword();

        try {
            await this.userRepository.save(user);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Failed to create user: ${errorMessage} - ${error instanceof Error ? error.stack : 'No stack trace available'}`,
            );
            throw new InternalServerErrorException('Failed to create user');
        }

        const tokens = this.generateTokens(user);

        return {
            user: this.sanitizeUser(user),
            ...tokens,
        };
    }

    /**
     * Authenticate user with email and password
     */
    async login(loginDto: LoginDto): Promise<AuthResponse> {
        const { email, password } = loginDto;

        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'name', 'password', 'createdAt', 'updatedAt'],
        });

        if (!user) {
            throw new NotFoundException(
                `User with email ${email} not found - kindly sign up to use the service`,
            );
        }

        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = this.generateTokens(user);

        return {
            user: this.sanitizeUser(user),
            ...tokens,
        };
    }

    /**
     * Validate user by ID (used by JwtStrategy)
     */
    async validateUser(userId: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { id: userId } });
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
        try {
            const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });

            const user = await this.validateUser(payload.userId);
            if (!user) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const accessToken = this.generateAccessToken(user);
            return { accessToken };
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    /**
     * Get current user by ID
     */
    async getCurrentUser(userId: string): Promise<UserResponse> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return this.sanitizeUser(user);
    }

    /**
     * Generate access and refresh tokens
     */
    private generateTokens(user: User): { accessToken: string; refreshToken: string } {
        const payload = {
            userId: user.id,
            email: user.email,
        };

        const accessEx = parseInt(
            this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15',
            10,
        );
        const refreshEx = parseInt(
            this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7',
            10,
        );

        const accessTokenOptions: JwtSignOptions = {
            expiresIn: accessEx,
        };
        const accessToken = this.jwtService.sign(payload, accessTokenOptions);

        const refreshTokenOptions: JwtSignOptions = {
            expiresIn: refreshEx,
        };
        const refreshToken = this.jwtService.sign(payload, refreshTokenOptions);

        return { accessToken, refreshToken };
    }

    /**
     * Generate access token only
     */
    private generateAccessToken(user: User): string {
        const payload = {
            userId: user.id,
            email: user.email,
        };

        const accessEx = parseInt(
            this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15',
            10,
        );

        const accessTokenOptions: JwtSignOptions = { expiresIn: accessEx };
        return this.jwtService.sign(payload, accessTokenOptions);
    }

    /**
     * Request password reset - generates token and sends email
     */
    async requestPasswordReset(dto: RequestPasswordResetDto): Promise<{ message: string }> {
        const { email } = dto;

        this.logger.log(`Received password reset request for email: ${email}`);

        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            // Don't leak user existence - return generic message
            return {
                message:
                    'If an account exists, a password reset link has been sent to the email address',
            };
        }

        // Invalidate ALL previous unused tokens for this email
        // Ensures only one password reset token is valid at a time
        await this.passwordResetTokenRepository.delete({
            email,
            used: false,
        });

        // Generate reset token (32 bytes = 64 hex characters)
        const plainToken = randomBytes(32).toString('hex');
        const hashedToken = PasswordResetToken.hashToken(plainToken);

        // Set expiry to 15 minutes from now
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        this.logger.log(
            `Generated password reset token for ${email}, expires at ${expiresAt.toISOString()}`,
        );

        const resetToken = this.passwordResetTokenRepository.create({
            email: user.email,
            tokenHash: hashedToken,
            expiresAt: expiresAt,
            user,
        });

        await this.passwordResetTokenRepository.save(resetToken);

        const frontendUrl =
            this.configService.get<string>('FRONTEND_PASSWORD_RESET_URL') ||
            'http://localhost:4200';
        const resetLink = `${frontendUrl}/reset-password?token=${plainToken}`;

        this.logger.log(
            `Generated password reset token for ${email}, expires at ${expiresAt.toISOString()} - reset link: ${resetLink}`,
        );

        await this.emailService.sendPasswordResetEmail(user.email, resetLink);

        return {
            message:
                'If an account exists, a password reset link has been sent to the email address',
        };
    }

    /**
     * Validate reset token - check if token exists, is not expired, and not used
     */
    async validateResetToken(plainToken: string): Promise<{ valid: boolean; email?: string }> {
        if (!plainToken) {
            return { valid: false };
        }

        try {
            const resetToken = await this.passwordResetTokenRepository.findOne({
                where: {
                    tokenHash: PasswordResetToken.hashToken(plainToken),
                    used: false,
                    expiresAt: MoreThan(new Date()),
                },
            });

            this.logger.log(
                `Validating reset token: ${plainToken} - found token: ${!!resetToken} - expires at: ${
                    resetToken ? resetToken.expiresAt.toISOString() : 'N/A'
                }`,
            );

            if (!resetToken) {
                return { valid: false };
            }

            return { valid: true, email: resetToken.email };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Failed to validate reset token: ${errorMessage} - ${error instanceof Error ? error.stack : 'No stack trace available'}`,
            );
            return { valid: false };
        }
    }

    /**
     * Reset password using token
     */
    async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
        const { token: plainToken, newPassword, confirmPassword } = dto;

        if (newPassword !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        if (!plainToken) {
            throw new BadRequestException('Invalid reset token');
        }

        const resetToken = await this.passwordResetTokenRepository.findOne({
            where: {
                tokenHash: PasswordResetToken.hashToken(plainToken),
                used: false,
                expiresAt: MoreThan(new Date()),
            },
            relations: ['user'],
        });

        if (!resetToken) {
            throw new BadRequestException('Invalid, expired, or already used reset token');
        }

        const user = await this.userRepository.findOne({ where: { id: resetToken.user.id } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.password = newPassword;
        await user.hashPassword();
        await this.userRepository.save(user);

        resetToken.used = true;
        await this.passwordResetTokenRepository.save(resetToken);

        return {
            message: 'Password reset successfully. You can now login with your new password.',
        };
    }

    /**
     * Change password for authenticated user
     */
    async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
        const { currentPassword, newPassword, confirmPassword } = dto;

        if (newPassword !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'email', 'name', 'password', 'createdAt', 'updatedAt'],
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isPasswordValid = await user.validatePassword(currentPassword);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        const isSamePassword = await user.validatePassword(newPassword);
        if (isSamePassword) {
            throw new BadRequestException('New password must be different from current password');
        }

        user.password = newPassword;
        await user.hashPassword();
        await this.userRepository.save(user);

        return { message: 'Password changed successfully' };
    }

    /**
     * Remove sensitive data from user object
     */
    private sanitizeUser(user: User): UserResponse {
        const { id, email, name, createdAt, updatedAt } = user;
        return { id, email, name, createdAt, updatedAt };
    }
}
