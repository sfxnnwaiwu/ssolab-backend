import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as oidc from 'openid-client';
import { v4 as uuidv4 } from 'uuid';
import { OidcConfigDto } from './dto/oidc-config.dto';
import {
    OidcConfig,
    OidcConfigResponse,
    OidcDiscoveryDocument,
} from './interfaces/oidc-config.interface';

@Injectable()
export class OidcService {
    private readonly logger = new Logger(OidcService.name);
    private readonly CONFIG_TTL = 900; // 15 minutes in seconds
    private readonly CONFIG_PREFIX = 'oidc:config:';
    private readonly DISCOVERY_PREFIX = 'oidc:discovery:';

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    /**
     * Store OIDC configuration in Redis with 15-minute TTL
     * Validates discovery URL and fetches discovery document
     * @param configDto OIDC configuration data
     * @returns Configuration ID and expiration timestamp
     */
    async storeConfig(configDto: OidcConfigDto): Promise<OidcConfigResponse> {
        // Fetch and validate discovery document
        const discoveryDocument = await this.fetchDiscoveryDocument(configDto.discoveryUrl);

        // Validate required endpoints
        this.validateDiscoveryDocument(discoveryDocument);

        // Generate unique config ID
        const configId = uuidv4();

        // Prepare config data
        const config: OidcConfig = {
            clientId: configDto.clientId,
            clientSecret: configDto.clientSecret,
            discoveryUrl: configDto.discoveryUrl,
            scopes: configDto.scopes,
            responseType: configDto.responseType,
        };

        // Store config in Redis with TTL
        const configKey = `${this.CONFIG_PREFIX}${configId}`;
        await this.cacheManager.set(configKey, JSON.stringify(config), this.CONFIG_TTL);

        // Store discovery document in Redis with TTL
        const discoveryKey = `${this.DISCOVERY_PREFIX}${configId}`;
        await this.cacheManager.set(
            discoveryKey,
            JSON.stringify(discoveryDocument),
            this.CONFIG_TTL,
        );

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + this.CONFIG_TTL * 1000).toISOString();

        this.logger.log(`Stored OIDC configuration with ID: ${configId}`);

        return {
            configId,
            expiresAt,
        };
    }

    /**
     * Retrieve OIDC configuration from Redis
     * @param configId Configuration ID
     * @returns OIDC configuration or null if not found
     */
    async getConfig(configId: string): Promise<OidcConfig | null> {
        const key = `${this.CONFIG_PREFIX}${configId}`;
        const data = await this.cacheManager.get<string>(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data) as OidcConfig;
    }

    /**
     * Retrieve discovery document from Redis
     * @param configId Configuration ID
     * @returns Discovery document or null if not found
     */
    async getDiscoveryDocument(configId: string): Promise<OidcDiscoveryDocument | null> {
        const key = `${this.DISCOVERY_PREFIX}${configId}`;
        const data = await this.cacheManager.get<string>(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data) as OidcDiscoveryDocument;
    }

    /**
     * Delete OIDC configuration from Redis
     * @param configId Configuration ID
     */
    async deleteConfig(configId: string): Promise<void> {
        const configKey = `${this.CONFIG_PREFIX}${configId}`;
        const discoveryKey = `${this.DISCOVERY_PREFIX}${configId}`;
        await this.cacheManager.del(configKey);
        await this.cacheManager.del(discoveryKey);
    }

    /**
     * Fetch discovery document from OIDC provider
     * @param discoveryUrl Discovery URL
     * @returns Discovery document
     */
    private async fetchDiscoveryDocument(discoveryUrl: string): Promise<OidcDiscoveryDocument> {
        try {
            this.logger.log(`Fetching discovery document from: ${discoveryUrl}`);

            // Extract issuer URL from discovery URL
            const issuerUrl = discoveryUrl.replace('/.well-known/openid-configuration', '');

            // Use openid-client to discover the configuration
            const configuration = await oidc.discovery(new URL(issuerUrl), issuerUrl);

            const metadata = configuration.serverMetadata();
            const discoveryDocument: OidcDiscoveryDocument = {
                ...metadata,
                issuer: metadata.issuer,
                authorization_endpoint: metadata.authorization_endpoint!,
                token_endpoint: metadata.token_endpoint!,
                jwks_uri: metadata.jwks_uri!,
                userinfo_endpoint: metadata.userinfo_endpoint,
                end_session_endpoint: metadata.end_session_endpoint,
                response_types_supported: metadata.response_types_supported || [],
                scopes_supported: metadata.scopes_supported,
                grant_types_supported: metadata.grant_types_supported,
                token_endpoint_auth_methods_supported:
                    metadata.token_endpoint_auth_methods_supported,
            };

            this.logger.log(
                `Successfully fetched discovery document from issuer: ${discoveryDocument.issuer}`,
            );

            return discoveryDocument;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to fetch discovery document: ${errorMessage}`, errorStack);
            throw new BadRequestException({
                type: 'invalid_discovery_url',
                title: 'Discovery Document Fetch Failed',
                description: 'Unable to fetch or parse the OIDC discovery document',
                technicalDetails: errorMessage,
                troubleshootingSteps: [
                    'Verify the discovery URL is accessible and returns valid JSON',
                    'Ensure the URL ends with /.well-known/openid-configuration',
                    'Check that the OIDC provider is online and responding',
                    'Verify network connectivity to the OIDC provider',
                    'Try accessing the discovery URL directly in a browser',
                ],
                relatedDocs: [
                    {
                        title: 'OpenID Connect Discovery Specification',
                        url: 'https://openid.net/specs/openid-connect-discovery-1_0.html',
                    },
                ],
            });
        }
    }

    /**
     * Validate that discovery document contains required endpoints
     * @param document Discovery document
     */
    private validateDiscoveryDocument(document: OidcDiscoveryDocument): void {
        const requiredEndpoints = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'];
        const missingEndpoints: string[] = [];

        for (const endpoint of requiredEndpoints) {
            if (!document[endpoint]) {
                missingEndpoints.push(endpoint);
            }
        }

        if (missingEndpoints.length > 0) {
            this.logger.error(
                `Discovery document missing required endpoints: ${missingEndpoints.join(', ')}`,
            );
            throw new BadRequestException({
                type: 'invalid_discovery_document',
                title: 'Invalid Discovery Document',
                description: 'The discovery document is missing required OIDC endpoints',
                technicalDetails: `Missing endpoints: ${missingEndpoints.join(', ')}`,
                troubleshootingSteps: [
                    'Verify the OIDC provider supports the Authorization Code Flow',
                    'Check that the provider is fully OIDC compliant',
                    'Ensure the discovery URL points to a valid OIDC provider',
                    "Review the provider's documentation for supported endpoints",
                    'Contact the OIDC provider support if endpoints are missing',
                ],
                relatedDocs: [
                    {
                        title: 'OIDC Core Specification',
                        url: 'https://openid.net/specs/openid-connect-core-1_0.html',
                    },
                ],
            });
        }

        this.logger.log('Discovery document validation passed');
    }
}
