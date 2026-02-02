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
    Res,
    Session,
} from '@nestjs/common';
import { Response } from 'express';
import { OIDC_ERROR_DETAILS } from '../../common/constants/oidc-errors.constant';
import { DetailedHttpException } from '../../common/exceptions/detailed-http.exception';
import { ErrorAuthResult } from '../session/interfaces/auth-result.interface';
import { SessionService } from '../session/session.service';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { OidcConfigResponse } from './interfaces/oidc-config.interface';
import { OidcService } from './oidc.service';

@Controller('api/oidc')
export class OidcController {
    private readonly logger = new Logger(OidcController.name);

    constructor(
        private readonly oidcService: OidcService,
        private readonly sessionService: SessionService,
    ) {}

    /**
     * Store OIDC configuration and validate discovery document
     * POST /api/oidc/config
     */
    @Post('config')
    @HttpCode(HttpStatus.CREATED)
    async storeConfig(@Body() configDto: OidcConfigDto): Promise<OidcConfigResponse> {
        this.logger.log('Received OIDC configuration request');
        this.logger.debug(`Client ID: ${configDto.clientId}`);
        this.logger.debug(`Discovery URL: ${configDto.discoveryUrl}`);
        this.logger.debug(`Scopes: ${configDto.scopes.join(', ')}`);
        this.logger.debug(`Response Types: ${configDto.responseType.join(', ')}`);

        const response = await this.oidcService.storeConfig(configDto);

        this.logger.log(`OIDC configuration stored with ID: ${response.configId}`);

        return response;
    }

    /**
     * Initiate OIDC authentication flow
     * GET /api/oidc/login/:configId
     */
    @Get('login/:configId')
    async login(
        @Param('configId') configId: string,
        @Session() session: Record<string, any>,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.log(`Initiating OIDC login for config: ${configId}`);

        try {
            // Generate authorization URL with state and nonce
            const { url, state, nonce, codeVerifier } =
                await this.oidcService.generateAuthorizationUrl(configId);

            // Store state and nonce in session
            this.sessionService.storeOidcState(session, state, nonce, configId, codeVerifier);

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

    /**
     * Handle OIDC callback from IdP
     * GET /api/oidc/callback
     */
    @Get('callback')
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Session() session: Record<string, any>,
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

            this.sessionService.storeAuthResult(session, errorResult);
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

            this.sessionService.storeAuthResult(session, errorResult);

            res.redirect(`${frontendUrl}/oidc/callback?error=invalid_state`);
            return;
        }

        try {
            // Exchange code for tokens and validate
            const authResult = await this.oidcService.handleCallback(code, state);

            // Store authentication result in session
            this.sessionService.storeAuthResult(session, authResult);

            // Clear OIDC state
            this.sessionService.clearOidcState(session);

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

            this.sessionService.storeAuthResult(session, errorResult);
            this.sessionService.clearOidcState(session);

            res.redirect(`${frontendUrl}/oidc/callback?error=callback_error`);
        }
    }
}
