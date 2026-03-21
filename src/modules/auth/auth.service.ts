import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { User } from './entities/user.entity';
import { AuthResponse, TokenPayload, UserResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
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
        } catch {
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
     * Remove sensitive data from user object
     */
    private sanitizeUser(user: User): UserResponse {
        const { id, email, name, createdAt, updatedAt } = user;
        return { id, email, name, createdAt, updatedAt };
    }
}
