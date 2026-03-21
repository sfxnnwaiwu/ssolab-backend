import { ApiProperty } from '@nestjs/swagger';

export class UserResponse {
    @ApiProperty({
        description: 'Unique user identifier',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
        format: 'email',
    })
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Timestamp when user account was created',
        example: '2026-03-21T10:00:00.000Z',
        type: 'string',
        format: 'date-time',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Timestamp when user account was last updated',
        example: '2026-03-21T10:00:00.000Z',
        type: 'string',
        format: 'date-time',
    })
    updatedAt: Date;
}

export class AuthResponse {
    @ApiProperty({
        description: 'Authenticated user information',
        type: UserResponse,
    })
    user: UserResponse;

    @ApiProperty({
        description: 'JWT access token for authenticated requests',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE3MTEwMDAwMDB9.SIGNATURE',
    })
    accessToken: string;

    @ApiProperty({
        description: 'Refresh token for obtaining new access tokens (optional)',
        example: 'refresh_token_value',
        required: false,
    })
    refreshToken?: string;
}

export class TokenPayload {
    @ApiProperty({
        description: 'User ID from JWT token',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    userId: string;

    @ApiProperty({
        description: 'User email from JWT token',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'Token issued at timestamp (Unix time)',
        example: 1711000000,
        required: false,
    })
    iat?: number;

    @ApiProperty({
        description: 'Token expiration timestamp (Unix time)',
        example: 1711003600,
        required: false,
    })
    exp?: number;
}
