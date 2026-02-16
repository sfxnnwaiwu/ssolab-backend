import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SAML } from '@node-saml/node-saml';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SAML_ERROR_DETAILS } from '../../common/constants/saml-errors.constant';
import { RequestLog, ResponseLog } from '../../common/interfaces/log.interface';
import { ConfigType, TestResult } from '../test-results/entities/test-result.entity';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SamlConfiguration } from './entities/saml-configuration.entity';
import { SamlAuthResult, SamlErrorResult } from './interfaces/saml-auth-result.interface';
import { SamlConfigResponse } from './interfaces/saml-config.interface';

@Injectable()
export class SamlService {
    private readonly logger = new Logger(SamlService.name);
    private readonly CONFIG_TTL = 900; // 15 minutes in seconds (for AuthnRequest cache)
    private readonly REQUEST_PREFIX = 'saml:request:';

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @InjectRepository(SamlConfiguration)
        private readonly samlConfigRepository: Repository<SamlConfiguration>,
        @InjectRepository(TestResult)
        private readonly testResultRepository: Repository<TestResult>,
    ) {}

    /**
     * Store SAML configuration in PostgreSQL database
     * @param configDto SAML configuration data
     * @param userId User ID from JWT token
     * @returns Configuration ID and metadata
     */
    async storeConfig(configDto: SamlConfigDto, userId: string): Promise<SamlConfigResponse> {
        // Create new configuration entity
        const existingConfig = await this.samlConfigRepository.findOne({
            where: { userId, idpName: configDto.idpName },
        });

        if (existingConfig) {
            this.logger.warn(
                `User ${userId} already has a configuration for IdP ${configDto.idpName}. It will be overwritten.`,
            );
            // update existing config instead of creating a new one to preserve createdAt timestamp and avoid duplicates
            await this.samlConfigRepository.update(existingConfig.id, {
                entityId: configDto.entityId,
                ssoUrl: configDto.ssoUrl,
                certificate: configDto.certificate,
                updatedAt: new Date(),
            });

            // const loginUrl = `/api/saml/login/${existingConfig.id}`;
            const loginUrl = `${process.env.BACKEND_BASE_URL}/api/saml/login/${existingConfig.id}`;

            console.log(`Generated login URL for SAML config ${existingConfig.id}: ${loginUrl}`);

            return {
                url: loginUrl,
                configId: existingConfig.id,
                expiresAt: '', // No expiration for database-stored configs
            };
        }

        // .then((existingConfig) => {
        // if (existingConfig) {
        //     this.logger.warn(`User ${userId} already has a configuration for IdP ${configDto.idpName}. It will be overwritten.`);
        //     return this.samlConfigRepository.delete(existingConfig.id);
        // });

        const config = this.samlConfigRepository.create({
            userId,
            idpName: configDto.idpName,
            entityId: configDto.entityId,
            ssoUrl: configDto.ssoUrl,
            certificate: configDto.certificate,
            protocol: 'SAML',
        });

        // Save to database
        const savedConfig = await this.samlConfigRepository.save(config);

        this.logger.log(`Stored SAML configuration ${savedConfig.id} for user ${userId}`);

        // Generate login URL for frontend redirect
        const loginUrl = `${process.env.BACKEND_BASE_URL}/api/saml/login/${savedConfig.id}`;

        console.log(`Generated login URL for SAML config ${savedConfig.id}: ${loginUrl}`);

        return {
            url: loginUrl,
            configId: savedConfig.id,
            expiresAt: '', // No expiration for database-stored configs
        };
    }

    /**
     * Retrieve SAML configuration from database
     * @param configId Configuration ID
     * @returns SAMLConfiguration entity or null if not found
     */
    async getConfig(configId: string): Promise<SamlConfiguration | null> {
        return this.samlConfigRepository.findOne({ where: { id: configId } });
    }

    /**
     * Delete SAML configuration from database
     * @param configId Configuration ID
     * @param userId User ID to verify ownership
     * @returns success boolean
     */
    async deleteConfig(configId: string, userId: string): Promise<boolean> {
        const result = await this.samlConfigRepository.delete({ id: configId, userId });
        return (result.affected ?? 0) > 0;
    }

    /**
     * Generate SAML AuthnRequest and return redirect URL
     * @param configId Configuration ID
     * @returns Redirect URL with SAMLRequest parameter
     */
    async generateAuthnRequest(configId: string, relayState: string): Promise<string> {
        const config = await this.getConfig(configId);

        if (!config) {
            throw new Error('Configuration not found or expired');
        }

        const requestId = `_${uuidv4()}`;
        const callbackUrl =
            process.env.SAML_CALLBACK_URL || 'http://localhost:3000/api/saml/callback';
        const issuer = process.env.SAML_ISSUER || 'http://localhost:3000';

        const effectiveRelayState = relayState || requestId;

        console.log(
            `Generating SAML AuthnRequest for config ${configId} with callback URL ${callbackUrl}`,
        );

        // Create SAML instance
        const saml = new SAML({
            issuer,
            callbackUrl,
            entryPoint: config.ssoUrl,
            idpCert: config.certificate,
            signatureAlgorithm: 'sha256',
        });

        // Generate AuthnRequest
        const request = await saml.getAuthorizeUrlAsync(effectiveRelayState, '', {});

        // Store request ID for validation
        await this.cacheManager.set(
            `${this.REQUEST_PREFIX}${effectiveRelayState}`,
            JSON.stringify({ configId, timestamp: new Date().toISOString() }),
            this.CONFIG_TTL,
        );

        this.logger.log(`Generated SAML AuthnRequest for config ${configId}`);

        return request;
    }

    /**
     * Validate and process SAML response
     * @param samlResponse Base64 encoded SAML response
     * @param relayState Optional relay state
     * @returns SAML authentication result or error
     */
    validateSamlResponse(
        samlResponse: string,
        relayState?: string,
    ): SamlAuthResult | SamlErrorResult {
        const requestLog: RequestLog = {
            method: 'POST',
            url: '/api/saml/callback',
            headers: {},
            body: { SAMLResponse: `${samlResponse.substring(0, 50)}...`, relayState },
            timestamp: new Date().toISOString(),
        };

        try {
            // Decode the base64 SAML response
            const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');

            // Extract issuer
            const issuerMatch = decodedResponse.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
            const issuer = issuerMatch ? issuerMatch[1] : '';

            // Extract subject
            const subjectMatch = decodedResponse.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
            const subject = subjectMatch ? subjectMatch[1] : '';

            // Extract session index
            const sessionMatch = decodedResponse.match(/SessionIndex="([^"]+)"/);
            const sessionIndex = sessionMatch ? sessionMatch[1] : '';

            // Extract conditions
            const notBeforeMatch = decodedResponse.match(/NotBefore="([^"]+)"/);
            const notOnOrAfterMatch = decodedResponse.match(/NotOnOrAfter="([^"]+)"/);
            const audienceMatch = decodedResponse.match(/<saml:Audience>([^<]+)<\/saml:Audience>/);

            const conditions = {
                notBefore: notBeforeMatch ? notBeforeMatch[1] : '',
                notOnOrAfter: notOnOrAfterMatch ? notOnOrAfterMatch[1] : '',
                audience: audienceMatch ? audienceMatch[1] : '',
            };

            // Extract attributes
            const userAttributes: Record<string, string | string[]> = {};
            const attributeRegex =
                /<saml:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g;
            let attributeMatch: RegExpExecArray | null;
            while ((attributeMatch = attributeRegex.exec(decodedResponse)) !== null) {
                const attributeName = attributeMatch[1];
                const attributeValue = attributeMatch[2];
                userAttributes[attributeName] = attributeValue;
            }

            const responseLog: ResponseLog = {
                status: 200,
                statusText: 'OK',
                headers: {},
                timestamp: new Date().toISOString(),
            };

            const authResult: SamlAuthResult = {
                success: true,
                protocol: 'saml',
                timestamp: new Date().toISOString(),
                samlResponse: {
                    decoded: {
                        issuer,
                        subject,
                        sessionIndex,
                        conditions,
                    },
                    raw: decodedResponse,
                },
                userAttributes,
                requestLog,
                responseLog,
            };

            this.logger.log(`Successfully validated SAML response for subject: ${subject}`);

            return authResult;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            let errorType = 'invalid_signature';
            if (errorMessage.toLowerCase().includes('expired')) {
                errorType = 'expired_assertion';
            } else if (errorMessage.toLowerCase().includes('audience')) {
                errorType = 'invalid_audience';
            } else if (errorMessage.toLowerCase().includes('attribute')) {
                errorType = 'missing_attributes';
            } else if (errorMessage.toLowerCase().includes('certificate')) {
                errorType = 'certificate_mismatch';
            } else if (
                errorMessage.toLowerCase().includes('parse') ||
                errorMessage.toLowerCase().includes('format')
            ) {
                errorType = 'invalid_response_format';
            } else if (errorMessage.toLowerCase().includes('destination')) {
                errorType = 'invalid_destination';
            }

            this.logger.error(`SAML response validation failed: ${errorMessage}`, errorStack);

            const responseLog: ResponseLog = {
                status: 500,
                statusText: 'Internal Server Error',
                headers: {},
                timestamp: new Date().toISOString(),
            };

            const errorDetails = SAML_ERROR_DETAILS[errorType];
            const errorResult: SamlErrorResult = {
                success: false,
                protocol: 'saml',
                error: {
                    ...errorDetails,
                    technicalDetails: `${errorDetails.technicalDetails} Original error: ${errorMessage}`,
                },
                requestLog,
                responseLog,
            };

            return errorResult;
        }
    }

    /**
     * Save SAML test result to database
     * @param configId Configuration ID
     * @param userId User ID
     * @param result SAML authentication result or error
     */
    async saveTestResult(
        configId: string,
        userId: string,
        result: SamlAuthResult | SamlErrorResult,
    ): Promise<void> {
        const testResult = this.testResultRepository.create({
            configurationId: configId,
            configType: ConfigType.SAML,
            userId,
            success: result.success,
            error: result.success ? null : result.error,
            claims: result.success ? result.userAttributes : null,
            tokens: null,
        });

        await this.testResultRepository.save(testResult);

        // Update lastTestedAt timestamp on configuration
        await this.samlConfigRepository.update(configId, {
            lastTestedAt: new Date(),
        });

        this.logger.log(`Saved test result for SAML config ${configId}`);
    }
}
