import { createHash } from 'crypto';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('password_reset_tokens')
@Index('idx_password_reset_token_email', ['email'])
@Index('idx_password_reset_token_expires_at', ['expiresAt'])
@Index('idx_password_reset_token_used', ['used'])
@Unique('UQ_password_reset_token_token_hash', ['tokenHash'])
export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Column({ name: 'token_hash', type: 'varchar', length: 255 })
    tokenHash: string;

    @Column({ type: 'boolean', default: false })
    used: boolean;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @ManyToOne(() => User, (user) => user.passwordResetTokens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    /**
     * Check if token has expired
     */
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    /**
     * Check if token has been used
     */
    isUsed(): boolean {
        return this.used;
    }

    /**
     * Check if token is valid (not expired and not used)
     */
    isValid(): boolean {
        return !this.isExpired() && !this.isUsed();
    }

    /**
     * Hash token using bcrypt
     */
    static hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    /**
     * Compare plain token with hashed token
     */
    static compareToken(plainToken: string, hashedToken: string): boolean {
        return this.hashToken(plainToken) === hashedToken;
    }
}
