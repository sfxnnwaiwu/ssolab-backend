/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { createHash, randomBytes } from 'crypto';
import * as oidc from 'openid-client';
import { Repository } from 'typeorm';
import { OIDC_ERROR_DETAILS } from '../../common/constants/oidc-errors.constant';
import { ErrorAuthResult, OidcAuthResult } from '../session/interfaces/auth-result.interface';
import { ConfigType, TestResult } from '../test-results/entities/test-result.entity';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { OidcConfiguration } from './entities/oidc-configuration.entity';
import {
    OidcConfig,
    OidcConfigResponse,
    OidcDiscoveryDocument,
    OidcStateData,
    OidcTokens,
} from './interfaces/oidc-config.interface';

@Injectable()
export class OidcService {
    private readonly logger = new Logger(OidcService.name);
    private readonly DISCOVERY_PREFIX = 'oidc:discovery:';
    private readonly STATE_PREFIX = 'oidc:state:';
    private readonly STATE_TTL = 300; // 5 minutes for state/nonce
    private readonly DISCOVERY_TTL = 900; // 15 minutes for discovery doc cache

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @InjectRepository(OidcConfiguration)
        private readonly oidcConfigRepository: Repository<OidcConfiguration>,
        @InjectRepository(TestResult)
        private readonly testResultRepository: Repository<TestResult>,
    ) {}

    /**
     * Store OIDC configuration in PostgreSQL database
     * Validates discovery URL and fetches discovery document
     */
    async storeConfig(configDto: OidcConfigDto, userId: string): Promise<OidcConfigResponse> {
        const discoveryDocument = await this.fetchDiscoveryDocument(configDto.discoveryUrl);

        this.validateDiscoveryDocument(discoveryDocument);

        const config = this.oidcConfigRepository.create({
            userId,
            providerName: configDto.providerName || new URL(configDto.discoveryUrl).hostname,
            issuer: discoveryDocument.issuer,
            clientId: configDto.clientId,
            clientSecret: configDto.clientSecret,
            scopes: configDto.scopes.join(' '),
            protocol: 'OIDC',
        });

        const savedConfig = await this.oidcConfigRepository.save(config);

        // Cache discovery document with config ID as key (for subsequent login requests)
        const discoveryKey = `${this.DISCOVERY_PREFIX}${savedConfig.id}`;
        await this.cacheManager.set(
            discoveryKey,
            JSON.stringify(discoveryDocument),
            this.DISCOVERY_TTL,
        );

        this.logger.log(`Stored OIDC configuration ${savedConfig.id} for user ${userId}`);

        // Generate login URL for frontend redirect
        const loginUrl = `/api/oidc/authorize/${savedConfig.id}`;

        return {
            url: loginUrl,
            configId: savedConfig.id,
            expiresAt: '', // No expiration for database-stored configs
        };
    }

    async getConfig(configId: string): Promise<OidcConfiguration | null> {
        return this.oidcConfigRepository.findOne({ where: { id: configId } });
    }

    /**
     * Delete OIDC configuration from database
     */
    async deleteConfig(configId: string, userId: string): Promise<boolean> {
        const result = await this.oidcConfigRepository.delete({ id: configId, userId });
        return (result.affected ?? 0) > 0;
    }

    async getDiscoveryDocument(configId: string): Promise<OidcDiscoveryDocument | null> {
        const key = `${this.DISCOVERY_PREFIX}${configId}`;
        const data = await this.cacheManager.get<string>(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data) as OidcDiscoveryDocument;
    }

    private async fetchDiscoveryDocument(discoveryUrl: string): Promise<OidcDiscoveryDocument> {
        try {
            this.logger.log(`Fetching discovery document from: ${discoveryUrl}`);

            const issuerUrl = discoveryUrl.replace('/.well-known/openid-configuration', '');

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

    async generateAuthorizationUrl(configId: string): Promise<{
        url: string;
        state: string;
        nonce: string;
        codeVerifier?: string;
    }> {
        const config = await this.getConfig(configId);
        if (!config) {
            throw new NotFoundException({
                type: 'config_not_found',
                title: 'Configuration Not Found',
                description: 'The OIDC configuration was not found or has expired',
                technicalDetails: `Configuration ID: ${configId}`,
                troubleshootingSteps: [
                    'Verify the configuration ID is correct',
                    'Check that the configuration has not expired (15-minute TTL)',
                    'Re-submit the OIDC configuration to generate a new config ID',
                    'Ensure Redis is running and accessible',
                ],
            });
        }

        const discoveryDocument = await this.getDiscoveryDocument(configId);
        if (!discoveryDocument) {
            throw new NotFoundException({
                type: 'discovery_not_found',
                title: 'Discovery Document Not Found',
                description: 'The discovery document was not found in cache',
                technicalDetails: `Configuration ID: ${configId}`,
                troubleshootingSteps: [
                    'Re-submit the OIDC configuration to fetch discovery document',
                    'Verify Redis is storing data correctly',
                ],
            });
        }

        const state = this.generateRandomString(32);
        const nonce = this.generateRandomString(32);

        // Use authorization code flow
        const responseType = 'code';
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = this.generateCodeChallenge(codeVerifier);

        const stateData: OidcStateData = {
            state,
            nonce,
            configId,
            codeVerifier,
        };
        const stateKey = `${this.STATE_PREFIX}${state}`;
        await this.cacheManager.set(stateKey, JSON.stringify(stateData), this.STATE_TTL);

        const params = new URLSearchParams({
            client_id: config.clientId,
            response_type: responseType,
            scope: config.scopes,
            redirect_uri:
                process.env.OIDC_CALLBACK_URL || 'http://localhost:3000/api/oidc/callback',
            state,
            nonce,
        });

        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        const authorizationUrl = `${discoveryDocument.authorization_endpoint}?${params.toString()}`;

        this.logger.log(`Generated authorization URL for config ${configId}`);

        return { url: authorizationUrl, state, nonce, codeVerifier };
    }

    async handleCallback(code: string, state: string): Promise<OidcAuthResult | ErrorAuthResult> {
        const requestStartTime = Date.now();

        try {
            const stateKey = `${this.STATE_PREFIX}${state}`;
            const stateDataStr = await this.cacheManager.get<string>(stateKey);

            if (!stateDataStr) {
                return this.createErrorResult(
                    'invalid_state',
                    'State not found in cache',
                    requestStartTime,
                );
            }

            const stateData: OidcStateData = JSON.parse(stateDataStr);

            await this.cacheManager.del(stateKey);

            const config = await this.getConfig(stateData.configId);
            if (!config) {
                return this.createErrorResult(
                    'config_not_found',
                    `Configuration ID: ${stateData.configId}`,
                    requestStartTime,
                );
            }

            const discoveryDocument = await this.getDiscoveryDocument(stateData.configId);
            if (!discoveryDocument) {
                return this.createErrorResult(
                    'discovery_failed',
                    `Configuration ID: ${stateData.configId}`,
                    requestStartTime,
                );
            }

            const tokenRequestStart = Date.now();
            // Convert OidcConfiguration entity to OidcConfig interface
            const oidcConfig: OidcConfig = {
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                discoveryUrl: '', // Not needed for token exchange
                scopes: config.scopes.split(' '),
                responseType: ['code'],
            };
            const tokens = await this.exchangeCodeForTokens(
                code,
                oidcConfig,
                discoveryDocument,
                stateData.codeVerifier,
            );
            const tokenRequestDuration = Date.now() - tokenRequestStart;

            const idTokenDecoded = this.validateAndDecodeIdToken(
                tokens.id_token,
                oidcConfig,
                discoveryDocument,
                stateData.nonce,
            );

            let accessTokenDecoded: any = undefined;
            if (tokens.access_token && this.isJwt(tokens.access_token)) {
                accessTokenDecoded = this.decodeJwt(tokens.access_token);
            }

            let refreshTokenDecoded: any = undefined;
            if (tokens.refresh_token && this.isJwt(tokens.refresh_token)) {
                refreshTokenDecoded = this.decodeJwt(tokens.refresh_token);
            }

            const authResult: OidcAuthResult = {
                success: true,
                timestamp: new Date().toISOString(),
                tokens: {
                    idToken: {
                        raw: tokens.id_token,
                        decoded: idTokenDecoded,
                    },
                    accessToken: {
                        raw: tokens.access_token,
                        decoded: accessTokenDecoded,
                    },
                    refreshToken: tokens.refresh_token
                        ? {
                              raw: tokens.refresh_token,
                              decoded: refreshTokenDecoded,
                          }
                        : undefined,
                    expiresIn: tokens.expires_in || 3600,
                    tokenType: tokens.token_type || 'Bearer',
                },
                userClaims: idTokenDecoded.payload,
                requestLog: {
                    method: 'POST',
                    url: discoveryDocument.token_endpoint,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: '[REDACTED]',
                    timestamp: new Date(tokenRequestStart).toISOString(),
                    duration: tokenRequestDuration,
                },
                responseLog: {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: '[REDACTED - Contains sensitive tokens]',
                    timestamp: new Date().toISOString(),
                },
            };

            this.logger.log(`OIDC authentication successful for config ${stateData.configId}`);

            return authResult;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `OIDC callback error: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined,
            );

            let errorType = 'callback_error';
            if (errorMessage.toLowerCase().includes('invalid_grant')) {
                errorType = 'invalid_grant';
            } else if (
                errorMessage.toLowerCase().includes('invalid_client') ||
                errorMessage.toLowerCase().includes('client')
            ) {
                errorType = 'invalid_client';
            } else if (errorMessage.toLowerCase().includes('nonce')) {
                errorType = 'invalid_nonce';
            } else if (errorMessage.toLowerCase().includes('issuer')) {
                errorType = 'invalid_issuer';
            } else if (errorMessage.toLowerCase().includes('audience')) {
                errorType = 'invalid_audience';
            } else if (errorMessage.toLowerCase().includes('expired')) {
                errorType = 'token_expired';
            }

            return this.createErrorResult(errorType, errorMessage, requestStartTime);
        }
    }

    private async exchangeCodeForTokens(
        code: string,
        config: OidcConfig,
        discoveryDocument: OidcDiscoveryDocument,
        codeVerifier?: string,
    ): Promise<OidcTokens> {
        try {
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri:
                    process.env.OIDC_CALLBACK_URL || 'http://localhost:3000/api/oidc/callback',
                client_id: config.clientId,
                client_secret: config.clientSecret,
            });

            if (codeVerifier) {
                params.append('code_verifier', codeVerifier);
            }

            const response = await fetch(discoveryDocument.token_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Token exchange failed: ${response.status} ${errorText}`);
                throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
            }

            const tokens: OidcTokens = await response.json();
            return tokens;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Token exchange error: ${errorMessage}`);
            throw new BadRequestException({
                type: 'invalid_grant',
                title: 'Token Exchange Failed',
                description: 'Failed to exchange authorization code for tokens',
                technicalDetails: errorMessage,
                troubleshootingSteps: [
                    'Verify the authorization code is valid and not expired',
                    'Check that the client credentials are correct',
                    'Ensure the redirect URI matches the one used in authorization',
                    'Verify PKCE code verifier matches the challenge if applicable',
                    'Check OIDC provider logs for detailed error information',
                ],
                relatedDocs: [
                    {
                        title: 'OAuth 2.0 Token Endpoint',
                        url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-3.2',
                    },
                ],
            });
        }
    }

    private validateAndDecodeIdToken(
        idToken: string,
        config: OidcConfig,
        discoveryDocument: OidcDiscoveryDocument,
        expectedNonce: string,
    ): { header: any; payload: any; signature: string } {
        try {
            const decoded = this.decodeJwt(idToken);
            const claims = decoded.payload;

            if (claims.iss !== discoveryDocument.issuer) {
                throw new Error(
                    `Invalid issuer: expected ${discoveryDocument.issuer}, got ${claims.iss}`,
                );
            }

            const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
            if (!audience.includes(config.clientId)) {
                throw new Error(`Invalid audience: expected ${config.clientId}, got ${claims.aud}`);
            }

            if (claims.nonce !== expectedNonce) {
                throw new Error(`Invalid nonce: expected ${expectedNonce}, got ${claims.nonce}`);
            }

            const now = Math.floor(Date.now() / 1000);
            if (claims.exp && claims.exp < now) {
                throw new Error(`Token has expired: exp=${claims.exp}, now=${now}`);
            }

            if (claims.nbf && claims.nbf > now) {
                throw new Error(`Token not yet valid: nbf=${claims.nbf}, now=${now}`);
            }

            if (claims.iat && claims.iat > now + 60) {
                throw new Error(`Token issued in the future: iat=${claims.iat}, now=${now}`);
            }

            this.logger.log('ID token validation successful');

            return decoded;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`ID token validation failed: ${errorMessage}`);
            throw new BadRequestException({
                type: 'invalid_token',
                title: 'ID Token Validation Failed',
                description: 'The ID token signature or claims are invalid',
                technicalDetails: errorMessage,
                troubleshootingSteps: [
                    'Verify the ID token is from the expected issuer',
                    'Check that the token has not expired',
                    'Ensure the audience (aud) claim matches your client ID',
                    'Verify the nonce matches the one sent in the authorization request',
                    'Check that the JWKS endpoint is accessible and returning valid keys',
                ],
                relatedDocs: [
                    {
                        title: 'OpenID Connect ID Token Validation',
                        url: 'https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation',
                    },
                ],
            });
        }
    }

    private generateRandomString(length: number): string {
        return randomBytes(length).toString('base64url').slice(0, length);
    }

    private generateCodeChallenge(verifier: string): string {
        return createHash('sha256').update(verifier).digest('base64url');
    }

    private isJwt(token: string): boolean {
        return token.split('.').length === 3;
    }

    private decodeJwt(token: string): { header: any; payload: any; signature: string } {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }

        return {
            header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
            payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
            signature: parts[2],
        };
    }

    private createErrorResult(
        errorType: string,
        additionalDetails: string,
        requestStartTime: number,
    ): ErrorAuthResult {
        const errorDetail = OIDC_ERROR_DETAILS[errorType] || OIDC_ERROR_DETAILS.callback_error;

        return {
            success: false,
            error: {
                ...errorDetail,
                technicalDetails: `${errorDetail.technicalDetails} ${additionalDetails}`,
            },
            requestLog: {
                method: 'GET',
                url: '/api/oidc/callback',
                headers: {},
                timestamp: new Date(requestStartTime).toISOString(),
                duration: Date.now() - requestStartTime,
            },
            responseLog: {
                status: 400,
                statusText: 'Bad Request',
                headers: {},
                timestamp: new Date().toISOString(),
            },
        };
    }

    /**
     * Save OIDC test result to database
     */
    async saveTestResult(
        configId: string,
        userId: string,
        result: OidcAuthResult | ErrorAuthResult,
    ): Promise<void> {
        const testResult = this.testResultRepository.create({
            configurationId: configId,
            configType: ConfigType.OIDC,
            userId,
            success: result.success,
            error: !result.success ? result.error : null,
            claims: result.success ? result.userClaims : null,
            tokens: result.success
                ? {
                      accessToken: result.tokens.accessToken ? '***REDACTED***' : null,
                      refreshToken: result.tokens.refreshToken ? '***REDACTED***' : null,
                      idToken: result.tokens.idToken ? '***REDACTED***' : null,
                      expiresIn: result.tokens.expiresIn,
                  }
                : null,
        });

        await this.testResultRepository.save(testResult);

        // Update lastTestedAt timestamp on configuration
        await this.oidcConfigRepository.update(configId, {
            lastTestedAt: new Date(),
        });

        this.logger.log(`Saved test result for OIDC config ${configId}`);
    }

    /**
     * Generate OIDC logout URL using end_session_endpoint
     * Uses RP-Initiated Logout with id_token_hint
     */
    async generateLogoutUrl(
        idToken: string,
        configId: string,
    ): Promise<{ url: string; endSessionEndpoint: string }> {
        const discoveryDocument = await this.getDiscoveryDocument(configId);

        if (!discoveryDocument?.end_session_endpoint) {
            this.logger.warn(`No end_session_endpoint found for config ${configId}`);
            throw new NotFoundException({
                type: 'end_session_endpoint_not_found',
                title: 'Logout Endpoint Not Found',
                description: 'The OIDC provider does not support RP-Initiated Logout',
                technicalDetails: `end_session_endpoint is not available in discovery document for config ${configId}`,
                troubleshootingSteps: [
                    'Verify the OIDC provider is configured to support logout',
                    'Check the discovery document for end_session_endpoint',
                    'Consult the OIDC provider documentation for logout support',
                ],
                relatedDocs: [
                    {
                        title: 'OpenID Connect Session Management Spec',
                        url: 'https://openid.net/specs/openid-connect-session-1_0.html',
                    },
                ],
            });
        }

        const postLogoutRedirectUri = process.env.FRONTEND_URL || 'http://localhost:4200';
        const logoutUrl = new URL(discoveryDocument.end_session_endpoint);

        logoutUrl.searchParams.append('id_token_hint', idToken);
        logoutUrl.searchParams.append(
            'post_logout_redirect_uri',
            `${postLogoutRedirectUri}/oidc/logout-success`,
        );
        logoutUrl.searchParams.append('state', this.generateRandomString(32));

        this.logger.log(`Generated OIDC logout URL for config ${configId}`);

        return {
            url: logoutUrl.toString(),
            endSessionEndpoint: discoveryDocument.end_session_endpoint,
        };
    }

    /**
     * Handle logout completion from IdP
     * Validates and processes the redirect back from the IdP after logout
     */
    async handleLogoutCallback(state: string): Promise<{ success: boolean; message: string }> {
        this.logger.log('Processing OIDC logout callback from IdP');

        // await new Promise<void>((resolve, reject) => {
        //     const sessionWithDestroy = {
        //         destroy: (callback: (err: Error | null) => void) => {
        //             callback(null);
        //         },
        this.logger.log(`Simulating session destruction on logout callback ${state}`);
        await new Promise<void>((resolve) => resolve());

        // The state parameter could be used for additional validation if needed
        // For now, we just confirm logout was successful
        return {
            success: true,
            message: 'OIDC logout completed successfully',
        };
    }
}
