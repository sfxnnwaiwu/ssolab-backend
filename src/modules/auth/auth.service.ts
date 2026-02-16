import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

        // Check if user already exists
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Create new user
        const user = this.userRepository.create({
            email,
            name,
            password,
        });

        // Hash password
        await user.hashPassword();

        try {
            await this.userRepository.save(user);
        } catch {
            throw new InternalServerErrorException('Failed to create user');
        }

        // Generate tokens
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

        // Find user with password field
        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'name', 'password', 'createdAt', 'updatedAt'],
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Validate password
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens
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

        const accessEx = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15m';
        const refreshEx = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7d';

        // Use sign with proper typing - using any to bypass strict JWT typing
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: accessEx,
        } as any);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: refreshEx,
        } as any);

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

        const accessEx = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15m';

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.jwtService.sign(payload, { expiresIn: accessEx } as any);
    }

    /**
     * Remove sensitive data from user object
     */
    private sanitizeUser(user: User): UserResponse {
        const { id, email, name, createdAt, updatedAt } = user;
        return { id, email, name, createdAt, updatedAt };
    }
}
