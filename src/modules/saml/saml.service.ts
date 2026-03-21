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
        const existingConfig = await this.samlConfigRepository.findOne({
            where: { userId, idpName: configDto.idpName },
        });

        if (existingConfig) {
            this.logger.warn(
                `User ${userId} already has a configuration for IdP ${configDto.idpName}. It will be overwritten.`,
            );

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
                expiresAt: '',
            };
        }

        const config = this.samlConfigRepository.create({
            userId,
            idpName: configDto.idpName,
            entityId: configDto.entityId,
            ssoUrl: configDto.ssoUrl,
            certificate: configDto.certificate,
            protocol: 'SAML',
        });

        const savedConfig = await this.samlConfigRepository.save(config);

        this.logger.log(`Stored SAML configuration ${savedConfig.id} for user ${userId}`);

        const loginUrl = `${process.env.BACKEND_BASE_URL}/api/saml/login/${savedConfig.id}`;

        console.log(`Generated login URL for SAML config ${savedConfig.id}: ${loginUrl}`);

        return {
            url: loginUrl,
            configId: savedConfig.id,
            expiresAt: '',
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

                const existing = userAttributes[attributeName];

                if (!existing) {
                    userAttributes[attributeName] = attributeValue;
                } else if (Array.isArray(existing)) {
                    existing.push(attributeValue);
                } else {
                    userAttributes[attributeName] = [existing, attributeValue];
                }
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

    /**
     * Generate SAML LogoutRequest XML
     * @param nameId SAML NameID from authentication response
     * @param sessionIndex Session index from authentication response
     * @param issuer Service provider entity ID
     * @returns SAML LogoutRequest XML
     */
    generateLogoutRequest(nameId: string, sessionIndex: string, issuer: string): string {
        const requestId = `_${Math.random().toString(36).substr(2, 9)}`;
        const issueInstant = new Date().toISOString();

        const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${issuer}">
  <saml:Issuer Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">${this.escapeXml(issuer)}</saml:Issuer>
  <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">${this.escapeXml(nameId)}</saml:NameID>
  <samlp:SessionIndex>${this.escapeXml(sessionIndex)}</samlp:SessionIndex>
</samlp:LogoutRequest>`;

        return logoutRequest;
    }

    /**
     * Validate SAML LogoutResponse from IdP
     * @param logoutResponse Base64 encoded LogoutResponse
     * @returns Validation result
     */
    validateLogoutResponse(logoutResponse: string): boolean {
        try {
            if (!logoutResponse) {
                this.logger.warn('LogoutResponse is empty or missing');
                return false;
            }

            // Decode base64
            const decodedResponse = Buffer.from(logoutResponse, 'base64').toString('utf-8');

            this.logger.debug(`Decoded LogoutResponse: ${decodedResponse.substring(0, 200)}...`);

            // Check for StatusCode Success
            const statusSuccess =
                decodedResponse.includes('urn:oasis:names:tc:SAML:2.0:status:Success') ||
                decodedResponse.includes(
                    'StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"',
                );

            if (statusSuccess) {
                this.logger.log('LogoutResponse validation successful');
                return true;
            } else {
                this.logger.warn('LogoutResponse indicates failure or non-success status');
                return false;
            }
        } catch (error) {
            this.logger.error(
                `Error validating LogoutResponse: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            return false;
        }
    }

    /**
     * Escape XML special characters
     * @param value String to escape
     * @returns Escaped string
     */
    private escapeXml(value: string): string {
        const xmlEscapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;',
        };

        return value.replace(/[&<>"']/g, (char) => xmlEscapeMap[char]);
    }
}
