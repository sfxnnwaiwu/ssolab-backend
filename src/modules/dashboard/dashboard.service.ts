import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OidcConfiguration } from '../oidc/entities/oidc-configuration.entity';
import { SamlConfiguration } from '../saml/entities/saml-configuration.entity';
import { TestResult } from '../test-results/entities/test-result.entity';

export interface ConfigurationSummary {
    id: string;
    name: string;
    protocol: 'SAML' | 'OIDC';
    lastTestedAt: Date | null;
    createdAt: Date;
}

export interface DashboardConfigurations {
    saml: ConfigurationSummary[];
    oidc: ConfigurationSummary[];
}

export interface ConfigurationDetails {
    id: string;
    name: string;
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
    protocol: 'SAML' | 'OIDC';
    lastTestedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    testCount: number;
}

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(SamlConfiguration)
        private readonly samlConfigRepository: Repository<SamlConfiguration>,
        @InjectRepository(OidcConfiguration)
        private readonly oidcConfigRepository: Repository<OidcConfiguration>,
        @InjectRepository(TestResult)
        private readonly testResultRepository: Repository<TestResult>,
    ) {}

    /**
     * Get all configurations for a user
     */
    async getConfigurations(userId: string): Promise<DashboardConfigurations> {
        const samlConfigs = await this.samlConfigRepository.find({
            where: { userId },
            order: { lastTestedAt: 'DESC', createdAt: 'DESC' },
        });

        const oidcConfigs = await this.oidcConfigRepository.find({
            where: { userId },
            order: { lastTestedAt: 'DESC', createdAt: 'DESC' },
        });

        return {
            saml: samlConfigs.map((config) => ({
                id: config.id,
                name: config.idpName,
                entityId: config.entityId,
                ssoUrl: config.ssoUrl,
                protocol: 'SAML' as const,
                lastTestedAt: config.lastTestedAt,
                createdAt: config.createdAt,
            })),
            oidc: oidcConfigs.map((config) => ({
                id: config.id,
                name: config.providerName,
                protocol: 'OIDC' as const,
                lastTestedAt: config.lastTestedAt,
                createdAt: config.createdAt,
            })),
        };
    }

    /**
     * Get single configuration details by ID
     */
    async getConfigurationById(
        configId: string,
        userId: string,
    ): Promise<ConfigurationDetails | null> {
        // Try SAML first
        const samlConfig = await this.samlConfigRepository.findOne({
            where: { id: configId, userId },
        });

        if (samlConfig) {
            const testCount = await this.testResultRepository.count({
                where: { configurationId: configId, userId },
            });

            return {
                id: samlConfig.id,
                name: samlConfig.idpName,
                entityId: samlConfig.entityId,
                ssoUrl: samlConfig.ssoUrl,
                certificate: samlConfig.certificate,
                protocol: 'SAML',
                lastTestedAt: samlConfig.lastTestedAt,
                createdAt: samlConfig.createdAt,
                updatedAt: samlConfig.updatedAt,
                testCount,
            };
        }

        // Try OIDC
        const oidcConfig = await this.oidcConfigRepository.findOne({
            where: { id: configId, userId },
        });

        if (oidcConfig) {
            const testCount = await this.testResultRepository.count({
                where: { configurationId: configId, userId },
            });

            return {
                id: oidcConfig.id,
                name: oidcConfig.providerName,
                protocol: 'OIDC',
                lastTestedAt: oidcConfig.lastTestedAt,
                createdAt: oidcConfig.createdAt,
                updatedAt: oidcConfig.updatedAt,
                testCount,
            };
        }

        return null;
    }

    /**
     * Delete a configuration (SAML or OIDC)
     */
    async deleteConfiguration(configId: string, userId: string): Promise<boolean> {
        // Try deleting from SAML
        const samlResult = await this.samlConfigRepository.delete({ id: configId, userId });
        if (samlResult.affected && samlResult.affected > 0) {
            return true;
        }

        // Try deleting from OIDC
        const oidcResult = await this.oidcConfigRepository.delete({ id: configId, userId });
        return (oidcResult.affected ?? 0) > 0;
    }

    /**
     * Get test results for a configuration
     */
    async getTestResults(
        configId: string,
        userId: string,
        limit: number = 10,
    ): Promise<TestResult[]> {
        return this.testResultRepository.find({
            where: { configurationId: configId, userId },
            order: { testedAt: 'DESC' },
            take: limit,
        });
    }
}
