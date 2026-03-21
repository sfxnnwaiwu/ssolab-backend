import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
        minLength: 2,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    name: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
        format: 'email',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password (minimum 8 characters)',
        example: 'SecurePassword123!',
        minLength: 8,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    password: string;
}
