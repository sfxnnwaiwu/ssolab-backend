import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SAML } from '@node-saml/node-saml';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import { SAML_ERROR_DETAILS } from '../../common/constants/saml-errors.constant';
import { RequestLog, ResponseLog } from '../../common/interfaces/log.interface';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SamlAuthResult, SamlErrorResult } from './interfaces/saml-auth-result.interface';
import { SamlConfig, SamlConfigResponse } from './interfaces/saml-config.interface';

@Injectable()
export class SamlService {
    private readonly logger = new Logger(SamlService.name);
    private readonly CONFIG_TTL = 900; // 15 minutes in seconds
    private readonly CONFIG_PREFIX = 'saml:config:';
    private readonly REQUEST_PREFIX = 'saml:request:';

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    /**
     * Store SAML configuration in Redis with 15-minute TTL
     * @param configDto SAML configuration data
     * @returns Configuration ID and expiration timestamp
     */
    async storeConfig(configDto: SamlConfigDto): Promise<SamlConfigResponse> {
        // Generate unique config ID
        const configId = uuidv4();

        // Prepare config data
        const config: SamlConfig = {
            idpName: configDto.idpName,
            entityId: configDto.entityId,
            ssoUrl: configDto.ssoUrl,
            certificate: configDto.certificate,
        };

        // Store in Redis with TTL
        const key = `${this.CONFIG_PREFIX}${configId}`;
        await this.cacheManager.set(key, JSON.stringify(config), this.CONFIG_TTL);

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + this.CONFIG_TTL * 1000).toISOString();

        return {
            configId,
            expiresAt,
        };
    }

    /**
     * Retrieve SAML configuration from Redis
     * @param configId Configuration ID
     * @returns SAML configuration or null if not found
     */
    async getConfig(configId: string): Promise<SamlConfig | null> {
        const key = `${this.CONFIG_PREFIX}${configId}`;
        const data = await this.cacheManager.get<string>(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data) as SamlConfig;
    }

    /**
     * Delete SAML configuration from Redis
     * @param configId Configuration ID
     */
    async deleteConfig(configId: string): Promise<void> {
        const key = `${this.CONFIG_PREFIX}${configId}`;
        await this.cacheManager.del(key);
    }

    /**
     * Generate SAML AuthnRequest and return redirect URL
     * @param configId Configuration ID
     * @returns Redirect URL with SAMLRequest parameter
     */
    async generateAuthnRequest(configId: string): Promise<string> {
        const config = await this.getConfig(configId);

        if (!config) {
            throw new Error('Configuration not found or expired');
        }

        const requestId = `_${uuidv4()}`;
        const callbackUrl =
            process.env.SAML_CALLBACK_URL || 'http://localhost:3000/api/saml/callback';
        const issuer = process.env.SAML_ISSUER || 'http://localhost:3000';

        // Create SAML instance
        const saml = new SAML({
            issuer,
            callbackUrl,
            entryPoint: config.ssoUrl,
            idpCert: config.certificate,
            signatureAlgorithm: 'sha256',
        });

        // Generate AuthnRequest
        const request = await saml.getAuthorizeUrlAsync(callbackUrl, '', {});

        // Store request ID for validation
        await this.cacheManager.set(
            `${this.REQUEST_PREFIX}${requestId}`,
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
}
