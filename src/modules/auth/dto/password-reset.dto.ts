import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

/**
 * DTO for requesting a password reset link via email
 */
export class RequestPasswordResetDto {
    @ApiProperty({
        description: 'User email address to receive password reset link',
        example: 'john.doe@example.com',
        format: 'email',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;
}

/**
 * DTO for resetting password with token
 */
export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password reset token from email link',
        example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5',
    })
    @IsNotEmpty()
    @IsString()
    token: string;

    @ApiProperty({
        description: 'New password (min 8 chars, uppercase, lowercase, digit, special char)',
        example: 'NewSecurePassword123!',
        minLength: 8,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, {
        message: 'Password must be at least 8 characters long',
    })
    @Matches(/[A-Z]/, {
        message: 'Password must contain at least one uppercase letter',
    })
    @Matches(/[a-z]/, {
        message: 'Password must contain at least one lowercase letter',
    })
    @Matches(/\d/, {
        message: 'Password must contain at least one digit',
    })
    @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, {
        message: 'Password must contain at least one special character',
    })
    newPassword: string;

    @ApiProperty({
        description: 'Confirm new password (must match newPassword)',
        example: 'NewSecurePassword123!',
    })
    @IsNotEmpty()
    @IsString()
    confirmPassword: string;
}

/**
 * DTO for authenticated users to change their password
 */
export class ChangePasswordDto {
    @ApiProperty({
        description: 'Current password for verification',
        example: 'CurrentPassword123!',
    })
    @IsNotEmpty()
    @IsString()
    currentPassword: string;

    @ApiProperty({
        description: 'New password (min 8 chars, uppercase, lowercase, digit, special char)',
        example: 'NewSecurePassword123!',
        minLength: 8,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, {
        message: 'Password must be at least 8 characters long',
    })
    @Matches(/[A-Z]/, {
        message: 'Password must contain at least one uppercase letter',
    })
    @Matches(/[a-z]/, {
        message: 'Password must contain at least one lowercase letter',
    })
    @Matches(/\d/, {
        message: 'Password must contain at least one digit',
    })
    @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, {
        message: 'Password must contain at least one special character',
    })
    newPassword: string;

    @ApiProperty({
        description: 'Confirm new password (must match newPassword)',
        example: 'NewSecurePassword123!',
    })
    @IsNotEmpty()
    @IsString()
    confirmPassword: string;
}
