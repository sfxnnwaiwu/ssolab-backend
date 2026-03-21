import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Param,
    Post,
    Query,
    Req,
    Res,
    Session,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { OIDC_ERROR_DETAILS } from '../../common/constants/oidc-errors.constant';
import { DetailedHttpException } from '../../common/exceptions/detailed-http.exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorAuthResult } from '../session/interfaces/auth-result.interface';
import { SessionService } from '../session/session.service';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { OidcConfigResponse } from './interfaces/oidc-config.interface';
import { OidcService } from './oidc.service';

@ApiTags('OIDC SSO')
@Controller('api/oidc')
export class OidcController {
    private readonly logger = new Logger(OidcController.name);

    constructor(
        private readonly oidcService: OidcService,
        private readonly sessionService: SessionService,
    ) {}

    @ApiOperation({
        summary: 'Store OIDC configuration',
        description: 'Save OIDC configuration and validate the OpenID Provider discovery document',
    })
    @ApiBearerAuth()
    @ApiBody({
        type: OidcConfigDto,
        description: 'OIDC configuration details',
    })
    @ApiCreatedResponse({
        description: 'OIDC configuration stored successfully',
        type: OidcConfigResponse,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid OIDC configuration or discovery document unreachable',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
    @Post('config')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(JwtAuthGuard)
    async storeConfig(
        @Body() configDto: OidcConfigDto,
        @Req() req: Request,
    ): Promise<OidcConfigResponse> {
        const user = req.user as { id: string; email: string };
        this.logger.log('Received OIDC configuration request');
        this.logger.debug(`Client ID: ${configDto.clientId}`);
        this.logger.debug(`Discovery URL: ${configDto.discoveryUrl}`);
        this.logger.debug(`Scopes: ${configDto.scopes.join(', ')}`);
        this.logger.debug(`Response Types: ${configDto.responseType.join(', ')}`);

        const response = await this.oidcService.storeConfig(configDto, user.id);

        this.logger.log(`OIDC configuration stored with ID: ${response.configId}`);

        return response;
    }

    @ApiOperation({
        summary: 'Initiate OIDC authentication flow',
        description:
            'Generate authorization URL and redirect user to OpenID Provider for authentication',
    })
    @ApiParam({
        name: 'configId',
        description: 'OIDC configuration ID',
        example: 'config_123456',
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to OIDC provider authorization endpoint',
    })
    @ApiResponse({
        status: 404,
        description: 'OIDC configuration not found',
    })
    @Get('login/:configId')
    async login(
        @Param('configId') configId: string,
        @Session() session: Record<string, any>,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log(`Initiating OIDC login for config: ${configId}`);

        try {
            // Verify configuration exists
            const config = await this.oidcService.getConfig(configId);
            if (!config) {
                throw new DetailedHttpException(
                    OIDC_ERROR_DETAILS.config_not_found,
                    HttpStatus.NOT_FOUND,
                );
            }

            // Generate authorization URL with state and nonce
            const { url, state, nonce, codeVerifier } =
                await this.oidcService.generateAuthorizationUrl(configId);

            // Store state, nonce, configId and userId in session
            this.sessionService.storeOidcState(session, state, nonce, configId, codeVerifier);
            session.oidcConfigId = configId;

            session.oidcUserId = config.userId;

            this.logger.log(`Redirecting to IdP authorization endpoint`);
            this.logger.debug(`Authorization URL: ${url}`);

            // Redirect to IdP authorization endpoint
            res.redirect(url);
        } catch (error) {
            this.logger.error('Failed to generate authorization URL', error);
            throw new DetailedHttpException(
                OIDC_ERROR_DETAILS.config_not_found,
                HttpStatus.NOT_FOUND,
            );
        }
    }

    @ApiOperation({
        summary: 'OIDC callback handler',
        description:
            'Handle callback from OIDC provider with authorization code. Throttled to 20 requests per 15 minutes.',
    })
    @ApiQuery({
        name: 'code',
        description: 'Authorization code from OIDC provider',
        required: false,
        example: '4/0AY0e-g...',
    })
    @ApiQuery({
        name: 'state',
        description: 'State parameter for CSRF protection',
        required: false,
        example: 'abc123def456',
    })
    @ApiQuery({
        name: 'error',
        description: 'Error code if authentication failed',
        required: false,
        example: 'access_denied',
    })
    @ApiQuery({
        name: 'error_description',
        description: 'Error description from OIDC provider',
        required: false,
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to frontend with success or error status',
    })
    @Get('callback')
    @Throttle({ strict: { limit: 20, ttl: 900000 } }) // 20 requests per 15 minutes
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Session() session: Record<string, any>,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log('Received OIDC callback');

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        // Check for error from IdP
        if (error) {
            this.logger.error(`OIDC error from IdP: ${error} - ${errorDescription}`);

            const errorResult: ErrorAuthResult = {
                success: false as const,
                error: {
                    type: error,
                    title: 'OIDC Authentication Error',
                    description: errorDescription || 'An error occurred during OIDC authentication',
                    technicalDetails: `Error: ${error}, Description: ${errorDescription}`,
                    troubleshootingSteps: [
                        'Check the error description for specific details',
                        'Verify the OIDC configuration is correct',
                        'Ensure the user has proper permissions',
                        'Check OIDC provider logs for more information',
                    ],
                },
                requestLog: {
                    method: 'GET',
                    url: '/api/oidc/callback',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
                responseLog: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
            };

            await this.sessionService.storeAuthResult(errorResult);
            this.sessionService.clearOidcState(session);

            res.redirect(`${frontendUrl}/oidc/callback?error=${error}`);
            return;
        }

        // Validate state
        const stateValidation = this.sessionService.validateOidcState(session, state);
        if (!stateValidation.valid) {
            this.logger.error('Invalid or missing state parameter');

            const errorResult: ErrorAuthResult = {
                success: false as const,
                error: {
                    type: 'invalid_state',
                    title: 'Invalid State Parameter',
                    description: 'The state parameter is invalid or has expired',
                    technicalDetails: 'State validation failed',
                    troubleshootingSteps: [
                        'Do not refresh the callback page',
                        'Complete the authentication flow within 5 minutes',
                        'Ensure cookies are enabled in your browser',
                        'Start a new authentication flow',
                    ],
                },
                requestLog: {
                    method: 'GET',
                    url: '/api/oidc/callback',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
                responseLog: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
            };

            await this.sessionService.storeAuthResult(errorResult);

            res.redirect(`${frontendUrl}/oidc/callback?error=invalid_state`);
            return;
        }

        try {
            // Exchange code for tokens and validate
            const authResult = await this.oidcService.handleCallback(code, state);

            // Store authentication result in session
            await this.sessionService.storeAuthResult(authResult);

            // Get configId and userId from session (stored during login initiation)
            const configId = session.oidcConfigId as string | undefined;
            const userId = session.oidcUserId as string | undefined;

            // Save test result to database if we have the metadata
            if (configId && userId) {
                await this.oidcService.saveTestResult(configId, userId, authResult);
            }

            // Store logout session data if authentication was successful
            if (authResult.success && configId) {
                const sessionId = req.sessionID;
                // Get the discovery document to extract end_session_endpoint
                const discoveryDoc = await this.oidcService.getDiscoveryDocument(configId);
                if (discoveryDoc?.end_session_endpoint) {
                    await this.sessionService.storeOidcLogoutSession(
                        sessionId,
                        authResult.tokens.idToken.raw,
                        discoveryDoc.end_session_endpoint,
                        configId,
                    );
                    this.logger.log(`Stored OIDC logout session data for session ${sessionId}`);
                }
            }

            // Clear OIDC state and metadata
            this.sessionService.clearOidcState(session);
            delete session.oidcConfigId;
            delete session.oidcUserId;

            if (authResult.success) {
                this.logger.log('OIDC authentication successful');
                res.redirect(`${frontendUrl}/oidc/callback?success=true`);
            } else {
                this.logger.error(`OIDC authentication failed: ${authResult.error.type}`);
                res.redirect(`${frontendUrl}/oidc/callback?error=${authResult.error.type}`);
            }
        } catch (error) {
            this.logger.error('Error processing OIDC callback', error);

            const errorResult: ErrorAuthResult = {
                success: false as const,
                error: {
                    type: 'callback_error',
                    title: 'Callback Processing Error',
                    description: 'An unexpected error occurred while processing the callback',
                    technicalDetails: error instanceof Error ? error.message : 'Unknown error',
                    troubleshootingSteps: [
                        'Check the server logs for detailed error information',
                        'Verify the OIDC provider is accessible',
                        'Ensure all configuration settings are correct',
                        'Try starting a new authentication flow',
                    ],
                },
                requestLog: {
                    method: 'GET',
                    url: '/api/oidc/callback',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
                responseLog: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: {},
                    timestamp: new Date().toISOString(),
                },
            };

            await this.sessionService.storeAuthResult(errorResult);
            this.sessionService.clearOidcState(session);

            res.redirect(`${frontendUrl}/oidc/callback?error=callback_error`);
        }
    }

    /**
     * Initiate OIDC logout flow (RP-Initiated Logout)
     * GET /api/oidc/logout?idToken=...&configId=...
     */
    @Get('logout')
    async logout(
        @Query('idToken') idToken: string,
        @Query('configId') configId: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log(`Initiating OIDC logout for config: ${configId}`);

        try {
            if (!idToken || !configId) {
                throw new DetailedHttpException(
                    {
                        type: 'missing_parameters',
                        title: 'Missing Parameters',
                        description: 'idToken and configId are required for logout',
                        technicalDetails: 'Missing required query parameters',
                        troubleshootingSteps: [
                            'Ensure idToken and configId are provided in the logout request',
                        ],
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Store logout session data in Redis for retrieval after IdP redirect
            const sessionId = req.sessionID;
            await this.sessionService.storeOidcLogoutSession(
                sessionId,
                idToken,
                '', // Will be populated with actual endpoint
                configId,
            );

            // Generate logout URL
            const { url, endSessionEndpoint } = await this.oidcService.generateLogoutUrl(
                idToken,
                configId,
            );

            // Update the stored logout session with the actual endpoint
            await this.sessionService.storeOidcLogoutSession(
                sessionId,
                idToken,
                endSessionEndpoint,
                configId,
            );

            // Clear OIDC state from session
            // const session = req.session as Record<string, any>;
            this.logger.log(`Redirecting to IdP logout endpoint for config ${configId}`);

            // Redirect to IdP logout endpoint
            res.redirect(url);
        } catch (error) {
            this.logger.error('Failed to initiate OIDC logout', error);
            throw new DetailedHttpException(
                {
                    type: 'logout_initiation_failed',
                    title: 'Logout Initiation Failed',
                    description: 'Failed to initiate logout with the OIDC provider',
                    technicalDetails: error instanceof Error ? error.message : 'Unknown error',
                    troubleshootingSteps: [
                        'Verify the OIDC configuration is valid',
                        'Ensure the IdP supports RP-Initiated Logout',
                        'Check that the id_token is valid and not expired',
                        'Review server logs for more details',
                    ],
                },
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Handle OIDC logout callback from IdP
     * GET /api/oidc/logout/callback
     * This endpoint is called by the IdP after the user is logged out
     */
    @Get('logout/callback')
    async logoutCallback(
        @Query('state') state: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log('Received OIDC logout callback from IdP');

        try {
            // Process logout completion
            const result = await this.oidcService.handleLogoutCallback(state);

            // Clear OIDC logout session data
            const sessionId = req.sessionID;
            await this.sessionService.clearOidcLogoutSession(sessionId);

            // Destroy the entire session
            await this.sessionService.destroySession(req.session);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

            if (result.success) {
                this.logger.log('OIDC logout completed successfully');
                res.redirect(`${frontendUrl}/oidc/logout-success`);
            } else {
                this.logger.warn('OIDC logout completed with errors');
                res.redirect(`${frontendUrl}/oidc/logout-complete?error=true`);
            }
        } catch (error) {
            this.logger.error('Error processing OIDC logout callback', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
            res.redirect(`${frontendUrl}/oidc/logout-complete?error=true`);
        }
    }
}
