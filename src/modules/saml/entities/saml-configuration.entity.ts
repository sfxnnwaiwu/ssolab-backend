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

@Entity('saml_configurations')
@Index(['userId', 'createdAt'])
export class SamlConfiguration {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'idp_name', type: 'varchar', length: 255 })
    idpName: string;

    @Column({ name: 'entity_id', type: 'text' })
    entityId: string;

    @Column({ name: 'sso_url', type: 'text' })
    ssoUrl: string;

    @Column({ name: 'slo_url', type: 'text', nullable: true })
    sloUrl: string | null;

    @Column({ name: 'certificate', type: 'text' })
    certificate: string;

    @Column({ type: 'varchar', length: 10, default: 'SAML' })
    protocol: string;

    @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
    lastTestedAt: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;
}
