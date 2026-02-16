import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum ConfigType {
    SAML = 'SAML',
    OIDC = 'OIDC',
}

@Entity('test_results')
@Index(['userId', 'testedAt'])
@Index(['configurationId', 'configType'])
export class TestResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'configuration_id', type: 'uuid' })
    @Index()
    configurationId: string;

    @Column({ name: 'config_type', type: 'enum', enum: ConfigType })
    configType: ConfigType;

    @Column({ name: 'user_id', type: 'uuid' })
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    // Note: Removed direct FK relationships to SAML/OIDC configs
    // because TypeORM can't handle polymorphic relationships with FKs
    // The configurationId + configType is sufficient for queries

    @Column({ type: 'boolean' })
    success: boolean;

    @Column({ type: 'jsonb', nullable: true })
    error: Record<string, any> | null;

    @Column({ type: 'jsonb', nullable: true })
    claims: Record<string, any> | null;

    @Column({ type: 'jsonb', nullable: true })
    tokens: Record<string, any> | null;

    @CreateDateColumn({ name: 'tested_at', type: 'timestamp' })
    @Index()
    testedAt: Date;
}
