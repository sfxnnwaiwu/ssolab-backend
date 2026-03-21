import {
    ApiBadRequestResponse,
    ApiBody,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiBearerAuth,
    ApiHeader,
} from '@nestjs/swagger';
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

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiOperation({
        summary: 'Register a new user',
        description: 'Create a new user account with email and password',
    })
    @ApiBody({
        type: SignupDto,
        description: 'User registration information',
    })
    @ApiCreatedResponse({
        description: 'User successfully registered',
        schema: {
            properties: {
                user: { $ref: '#/components/schemas/UserResponse' },
                accessToken: { type: 'string' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid input (validation failed)',
        schema: {
            example: {
                message: ['email must be an email'],
                error: 'Bad Request',
                statusCode: 400,
            },
        },
    })
    @ApiResponse({
        status: 409,
        description: 'User with this email already exists',
    })
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

    @ApiOperation({
        summary: 'Authenticate user',
        description: 'Login with email and password to receive access token',
    })
    @ApiBody({
        type: LoginDto,
        description: 'User login credentials',
    })
    @ApiOkResponse({
        description: 'User successfully authenticated',
        schema: {
            properties: {
                user: { $ref: '#/components/schemas/UserResponse' },
                accessToken: { type: 'string' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid credentials or validation failed',
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid email or password',
    })
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

    @ApiOperation({
        summary: 'Refresh access token',
        description: 'Get a new access token using the refresh token from the httpOnly cookie',
    })
    @ApiHeader({
        name: 'Cookie',
        description: 'Must include refreshToken cookie from login/signup response',
        required: true,
    })
    @ApiOkResponse({
        description: 'New access token generated successfully',
        schema: {
            properties: {
                accessToken: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Refresh token not found or invalid',
    })
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ accessToken: string }> {
        const refreshToken = req.cookies?.refreshToken as string | undefined;

        if (!refreshToken) {
            res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token not found' });
            throw new Error('Refresh token not found');
        }

        const result = await this.authService.refreshToken(refreshToken);
        return result;
    }

    @ApiOperation({
        summary: 'User logout',
        description: 'Clear the refresh token cookie and logout the user',
    })
    @ApiOkResponse({
        description: 'User successfully logged out',
        schema: {
            properties: {
                message: { type: 'string', example: 'Logged out successfully' },
            },
        },
    })
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

    @ApiOperation({
        summary: 'Get current user',
        description: 'Retrieve the authenticated user information from JWT token',
    })
    @ApiBearerAuth()
    @ApiOkResponse({
        description: 'Current user information',
        type: UserResponse,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - no valid JWT token provided',
    })
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
