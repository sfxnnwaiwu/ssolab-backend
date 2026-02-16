import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResponse, UserResponse } from './interfaces/auth-response.interface';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * POST /api/auth/signup
     * Register a new user
     */
    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    async signup(
        @Body() signupDto: SignupDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<AuthResponse, 'refreshToken'>> {
        const result = await this.authService.signup(signupDto);

        // Set refresh token as httpOnly cookie
        if (result.refreshToken) {
            this.setRefreshTokenCookie(res, result.refreshToken);
        }

        // Return user and access token (don't send refresh token in body)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { refreshToken, ...response } = result;
        return response;
    }

    /**
     * POST /api/auth/login
     * Authenticate user and get tokens
     */
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    async login(
        @Body() loginDto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<AuthResponse, 'refreshToken'>> {
        const result = await this.authService.login(loginDto);

        // Set refresh token as httpOnly cookie
        if (result.refreshToken) {
            this.setRefreshTokenCookie(res, result.refreshToken);
        }

        // Return user and access token
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { refreshToken, ...response } = result;
        return response;
    }

    /**
     * POST /api/auth/refresh
     * Refresh access token using refresh token from cookie
     */
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ accessToken: string }> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const refreshToken = req.cookies?.refreshToken as string | undefined;

        if (!refreshToken) {
            res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token not found' });
            throw new Error('Refresh token not found');
        }

        const result = await this.authService.refreshToken(refreshToken);
        return result;
    }

    /**
     * POST /api/auth/logout
     * Clear refresh token cookie
     */
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Res({ passthrough: true }) res: Response): { message: string } {
        // Clear refresh token cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return { message: 'Logged out successfully' };
    }

    /**
     * GET /api/auth/me
     * Get current authenticated user
     */
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getCurrentUser(@Req() req: Request): Promise<UserResponse> {
        // User is attached by JwtAuthGuard
        const user = req.user as { id: string; email: string };
        return this.authService.getCurrentUser(user.id);
    }

    /**
     * Helper method to set refresh token cookie
     */
    private setRefreshTokenCookie(res: Response, refreshToken: string): void {
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, // Prevent XSS attacks
            secure: isProduction, // HTTPS only in production
            sameSite: 'lax', // CSRF protection
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        });
    }
}
