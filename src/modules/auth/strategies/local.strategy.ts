import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
    constructor(private readonly authService: AuthService) {
        super({
            usernameField: 'email', // Use email instead of username
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<User> {
        try {
            const result = await this.authService.login({ email, password });
            // Note: This returns the auth response, but we only need the user
            // The actual login is handled in the controller
            return result.user as any;
        } catch (error) {
            throw new UnauthorizedException('Invalid credentials');
        }
    }
}
