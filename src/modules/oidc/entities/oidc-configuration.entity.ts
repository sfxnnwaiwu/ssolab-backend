import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('oidc_configurations')
@Index(['userId', 'createdAt'])
export class OidcConfiguration {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'provider_name', type: 'varchar', length: 255 })
    providerName: string;

    @Column({ name: 'issuer', type: 'text' })
    issuer: string;

    @Column({ name: 'client_id', type: 'varchar', length: 500 })
    clientId: string;

    @Column({ name: 'client_secret', type: 'text' })
    clientSecret: string;

    @Column({ name: 'scopes', type: 'text' })
    scopes: string;

    @Column({ type: 'varchar', length: 10, default: 'OIDC' })
    protocol: string;

    @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
    lastTestedAt: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
