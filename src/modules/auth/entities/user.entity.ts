import * as bcrypt from 'bcrypt';
import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PasswordResetToken } from './password-reset-token.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255, select: false })
    password: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

    @OneToMany('SamlConfiguration', 'user')
    samlConfigurations: any[];

    @OneToMany('OidcConfiguration', 'user')
    oidcConfigurations: any[];

    @OneToMany('TestResult', 'user')
    testResults: any[];

    @OneToMany(() => PasswordResetToken, (passwordResetToken) => passwordResetToken.user)
    passwordResetTokens: PasswordResetToken[];

    /**
     * Hash password before inserting
     */
    async hashPassword(): Promise<void> {
        if (this.password) {
            this.password = await bcrypt.hash(this.password, 10);
        }
    }

    /**
     * Validate password against hashed password
     */
    async validatePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password);
    }

    /**
     * Convert to JSON, excluding sensitive fields
     */
    toJSON() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...user } = this;
        return user;
    }
}
