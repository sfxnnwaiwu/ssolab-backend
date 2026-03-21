import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Param,
    Post,
    Req,
    Res,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Cache } from 'cache-manager';
import { Request, Response } from 'express';
import { SAML_ERROR_DETAILS } from '../../common/constants/saml-errors.constant';
import { DetailedHttpException } from '../../common/exceptions/detailed-http.exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorAuthResult } from '../session/interfaces/auth-result.interface';
import { SessionService } from '../session/session.service';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SamlAuthResult } from './interfaces/saml-auth-result.interface';
import { SamlConfigResponse } from './interfaces/saml-config.interface';
import { SamlService } from './saml.service';

interface RelayStateData {
    configId: string;
    userId: string;
    timestamp: number;
}

@ApiTags('SAML SSO')
@Controller('api/saml')
export class SamlController {
    constructor(
        private readonly samlService: SamlService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly sessionService: SessionService,
    ) {}

    @ApiOperation({
        summary: 'Store SAML configuration',
        description:
            'Save SAML IdP configuration for authentication flow. Validates certificate format.',
    })
    @ApiBearerAuth()
    @ApiBody({
        type: SamlConfigDto,
        description: 'SAML IdP configuration details',
    })
    @ApiCreatedResponse({
        description: 'SAML configuration stored successfully',
        type: SamlConfigResponse,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid SAML configuration or certificate',
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - valid JWT token required',
    })
    @Post('config')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(JwtAuthGuard)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async storeConfig(
        @Body() configDto: SamlConfigDto,
        @Req() req: Request,
    ): Promise<SamlConfigResponse> {
        const user = req.user as { id: string; email: string };
        return this.samlService.storeConfig(configDto, user.id);
    }

    @ApiOperation({
        summary: 'Initiate SAML authentication flow',
        description:
            'Generate SAML authentication request and redirect user to SAML Identity Provider',
    })
    @ApiParam({
        name: 'configId',
        description: 'SAML configuration ID',
        example: 'config_789012',
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to SAML provider login page',
    })
    @ApiResponse({
        status: 404,
        description: 'SAML configuration not found',
    })
    @Get('login/:configId')
    async login(@Param('configId') configId: string, @Req() req: Request, @Res() res: Response) {
        console.log('SAMLController - login - configId:', configId);

        try {
            // Verify config
            const config = await this.samlService.getConfig(configId);
            if (!config) {
                throw new DetailedHttpException(
                    SAML_ERROR_DETAILS.config_not_found,
                    HttpStatus.NOT_FOUND,
                );
            }

            // Store configId and userId in session for callback
            // req.session.samlConfigId = configId;
            // req.session.samlUserId = config.userId;

            const callbackUrl =
                process.env.SAML_CALLBACK_URL || 'http://localhost:3000/api/saml/callback';

            // Encode configId and userId in RelayState instead of session
            const relayStateData = {
                configId,
                userId: config.userId,
                timestamp: Date.now(),
                callbackUrl,
            };

            const relayState = Buffer.from(JSON.stringify(relayStateData)).toString('base64');

            const redirectUrl = await this.samlService.generateAuthnRequest(configId, relayState);

            // Redirect to IdP SSO URL with SAMLRequest
            return res.redirect(302, redirectUrl);
        } catch {
            throw new DetailedHttpException(
                SAML_ERROR_DETAILS.config_not_found,
                HttpStatus.NOT_FOUND,
            );
        }
    }

    @ApiOperation({
        summary: 'Validate SAML response',
        description:
            'Validate SAML response from IdP (called by frontend). Throttled to 20 requests per 15 minutes.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                SAMLResponse: {
                    type: 'string',
                    description: 'SAML Response in Base64 format',
                    example:
                        'PFJlc3BvbnNlIHhtbG5zPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPi4uLjwvUmVzcG9uc2U+',
                },
                RelayState: {
                    type: 'string',
                    description: 'Relay State for tracking request-response correlation',
                    example: 'eyJjb25maWdJZCI6ImNvbmZpZ18xMjM0NTYiLCJ1c2VySWQiOiJ1c2VyXzEyMzQ1NiJ9',
                },
            },
            required: ['SAMLResponse'],
        },
    })
    @ApiOkResponse({
        description: 'SAML response validation result',
        type: SamlAuthResult,
    })
    @ApiResponse({
        status: 400,
        description: 'Missing or invalid SAML response',
    })
    @Post('validate')
    @Throttle({ strict: { limit: 20, ttl: 900000 } })
    async validate(
        @Body('SAMLResponse') samlResponse: string,
        @Body('RelayState') relayState: string | undefined,
        @Req() req: Request,
    ): Promise<SamlAuthResult | ErrorAuthResult> {
        console.log('SAMLController - validate - received SAMLResponse and RelayState');

        let configId: string | undefined;
        let userId: string | undefined;

        if (!samlResponse) {
            throw new DetailedHttpException(
                SAML_ERROR_DETAILS.saml_response_missing,
                HttpStatus.BAD_REQUEST,
            );
        }

        const result = this.samlService.validateSamlResponse(samlResponse, relayState);

        // Get configId and userId from session (stored during login initiation)
        // configId = req.session.samlConfigId;
        // userId = req.session.samlUserId;

        console.log(
            `SAMLController - validate - validation result: ${JSON.stringify(req, null, 2)}`,
        );

        if (relayState) {
            try {
                // Try to decode as base64 JSON first
                const decoded = JSON.parse(
                    Buffer.from(relayState, 'base64').toString('utf-8'),
                ) as RelayStateData;
                configId = decoded?.configId;
                userId = decoded?.userId;
            } catch {
                // If not JSON, treat as cache key
                const cachedData = await this.cacheManager.get(`saml:request:${relayState}`);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData as string) as RelayStateData;
                    configId = parsed?.configId;
                    userId = parsed?.userId;
                }
            }
        }

        // Save test result to database
        if (configId && userId) {
            await this.samlService.saveTestResult(configId, userId, result);
            // Clean up session data
            // delete req.session.samlConfigId;
            // delete req.session.samlUserId;
        }

        return result;
    }

    @ApiOperation({
        summary: 'Handle SAML response from IdP',
        description:
            'Process SAML response from IdP and redirect to frontend with auth result. Throttled to 20 requests per 15 minutes.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                SAMLResponse: {
                    type: 'string',
                    description: 'SAML Response in Base64 format from IdP',
                },
                RelayState: {
                    type: 'string',
                    description: 'Relay State matching the original request',
                },
            },
            required: ['SAMLResponse'],
        },
    })
    @ApiResponse({
        status: 302,
        description: 'Redirect to frontend with authentication result',
    })
    @Post('callback')
    @Throttle({ strict: { limit: 20, ttl: 900000 } }) // 20 requests per 15 minutes
    async callback(
        @Body('SAMLResponse') samlResponse: string,
        @Body('RelayState') relayState: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        console.log('SAMLController - callback - received SAMLResponse and RelayState');

        let configId: string | undefined;
        let userId: string | undefined;

        if (!samlResponse) {
            throw new DetailedHttpException(
                SAML_ERROR_DETAILS.saml_response_missing,
                HttpStatus.BAD_REQUEST,
            );
        }

        if (relayState) {
            try {
                // Try to decode as base64 JSON first
                const decoded = JSON.parse(
                    Buffer.from(relayState, 'base64').toString('utf-8'),
                ) as RelayStateData;
                configId = decoded?.configId;
                userId = decoded?.userId;
            } catch {
                // If not JSON, treat as cache key
                const cachedData = await this.cacheManager.get(`saml:request:${relayState}`);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData as string) as RelayStateData;
                    configId = parsed?.configId;
                    userId = parsed?.userId;
                }
            }
        }

        const result = this.samlService.validateSamlResponse(samlResponse, relayState);

        console.log(
            `SAMLController - callback - validation result: ${JSON.stringify(result, null, 2)}`,
        );

        // Store result in session for frontend retrieval
        req.session.authResult = result;

        // Get configId and userId from session (stored during login initiation)
        // const configId = req.session.samlConfigId;
        // const userId = req.session.samlUserId;

        const resultId = await this.sessionService.storeAuthResult(result);

        await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('Failed to save session:', err);
                    reject(err instanceof Error ? err : new Error(String(err)));
                } else {
                    resolve();
                }
            });
        });

        // Save test result to database if we have the metadata
        if (configId && userId) {
            await this.samlService.saveTestResult(configId, userId, result);
            // Clean up session data
            // delete req.session.samlConfigId;
            // delete req.session.samlUserId;
        }

        // Store SAML logout session data if authentication was successful
        if (result.success && configId && result.samlResponse?.decoded) {
            const sessionId = req.sessionID;
            const config = await this.samlService.getConfig(configId);
            if (config && result.samlResponse.decoded.sessionIndex) {
                const nameIdFormat =
                    result.samlResponse?.decoded?.['NameIDFormat'] ||
                    'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';
                await this.sessionService.storeSamlLogoutSession(
                    sessionId,
                    result.samlResponse.decoded.sessionIndex,
                    result.samlResponse.decoded.subject,
                    nameIdFormat,
                    config.sloUrl || '',
                    configId,
                );
                console.log(
                    `SAMLController - callback - Stored SAML logout session data for session ${sessionId}`,
                );
            }
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        if (result.success) {
            // Redirect to frontend with success parameter
            return res.redirect(
                302,
                `${frontendUrl}/saml/callback?success=true&resultId=${resultId}`,
            );
        } else {
            // Redirect to frontend with error parameter
            return res.redirect(302, `${frontendUrl}/saml/callback?error=${result.error.type}`);
        }
    }

    /**
     * GET /api/saml/logout
     * Initiate SAML Single Logout (SP-Initiated SLO)
     */
    @Get('logout')
    async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
        console.log('SAMLController - logout - initiating SAML SLO');

        try {
            const sessionId = req.sessionID;

            // Retrieve logout session data from cache
            const logoutSession = await this.sessionService.getSamlLogoutSession(sessionId);

            if (!logoutSession) {
                throw new DetailedHttpException(
                    {
                        type: 'logout_session_not_found',
                        title: 'Logout Session Not Found',
                        description: 'No SAML session data available for logout',
                        technicalDetails: 'Logout session data not found in cache',
                        troubleshootingSteps: [
                            'Ensure you are logged in before attempting to logout',
                            'Check that the SAML authentication was successful',
                        ],
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            const config = await this.samlService.getConfig(logoutSession.configId);
            if (!config || !logoutSession.sloUrl) {
                throw new DetailedHttpException(
                    {
                        type: 'slo_url_not_found',
                        title: 'SLO Endpoint Not Found',
                        description: 'The SAML provider does not support Single Logout',
                        technicalDetails: 'slo_url is not configured for this SAML provider',
                        troubleshootingSteps: [
                            'Verify the SAML provider supports Single Logout (SLO)',
                            'Check that the SLO URL is configured in the SAML IdP setup',
                            'Consult the SAML provider documentation for SLO support',
                        ],
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Generate LogoutRequest
            const logoutRequest = this.samlService.generateLogoutRequest(
                logoutSession.nameId,
                logoutSession.sessionIndex,
                config.entityId,
            );

            // Encode LogoutRequest: deflate and base64
            const zlib = require('zlib');
            const deflated = zlib.deflateSync(logoutRequest);
            const encoded = deflated.toString('base64');

            // Build SLO URL with LogoutRequest
            const sloUrl = new URL(logoutSession.sloUrl);
            sloUrl.searchParams.append('SAMLRequest', encoded);
            sloUrl.searchParams.append('RelayState', sessionId);

            console.log(`SAMLController - logout - redirecting to SLO URL: ${sloUrl.toString()}`);

            // Clear logout session data before redirecting
            await this.sessionService.clearSamlLogoutSession(sessionId);

            // Redirect to IdP SLO endpoint
            res.redirect(302, sloUrl.toString());
        } catch (error) {
            console.error('SAMLController - logout - error initiating SLO:', error);
            if (error instanceof DetailedHttpException) {
                throw error;
            }
            throw new DetailedHttpException(
                {
                    type: 'logout_initiation_failed',
                    title: 'Logout Initiation Failed',
                    description: 'Failed to initiate SAML Single Logout',
                    technicalDetails: error instanceof Error ? error.message : 'Unknown error',
                    troubleshootingSteps: [
                        'Verify the SAML configuration is valid',
                        'Ensure the IdP supports Single Logout (SLO)',
                        'Check server logs for more details',
                    ],
                },
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * POST /api/saml/logout/callback
     * Handle SAML LogoutResponse from IdP (HTTP-POST binding)
     */
    @Post('logout/callback')
    @Throttle({ strict: { limit: 20, ttl: 900000 } })
    async logoutCallbackPost(
        @Body('SAMLResponse') samlResponse: string | undefined,
        @Body('RelayState') relayState: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        console.log('SAMLController - logoutCallbackPost - received SAMLResponse');

        try {
            const sessionId = relayState || req.sessionID;

            // Validate LogoutResponse
            if (samlResponse) {
                const isValid = await this.samlService.validateLogoutResponse(samlResponse);
                console.log(
                    `SAMLController - logoutCallbackPost - LogoutResponse validation result: ${isValid}`,
                );
            }

            // Clear logout session data
            await this.sessionService.clearSamlLogoutSession(sessionId);

            // Destroy the entire session
            await this.sessionService.destroySession(req.session);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

            console.log('SAMLController - logoutCallbackPost - SAML SLO completed successfully');
            // Redirect to frontend callback with loggedOut=true parameter
            // The frontend will then navigate to logout-success page
            res.redirect(302, `${frontendUrl}/saml/callback?loggedOut=true`);
        } catch (error) {
            console.error('SAMLController - logoutCallbackPost - error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
            res.redirect(302, `${frontendUrl}/saml/callback?loggedOut=false&error=callback_error`);
        }
    }

    /**
     * GET /api/saml/logout/callback
     * Handle SAML LogoutResponse from IdP (HTTP-Redirect binding)
     */
    @Get('logout/callback')
    @Throttle({ strict: { limit: 20, ttl: 900000 } })
    async logoutCallbackGet(@Req() req: Request, @Res() res: Response): Promise<void> {
        console.log('SAMLController - logoutCallbackGet - received SAMLResponse via HTTP-Redirect');

        try {
            const relayState = req.query.RelayState as string | undefined;
            const samlResponse = req.query.SAMLResponse as string | undefined;

            const sessionId = relayState || req.sessionID;

            // Validate LogoutResponse
            if (samlResponse) {
                const isValid = await this.samlService.validateLogoutResponse(samlResponse);
                console.log(
                    `SAMLController - logoutCallbackGet - LogoutResponse validation result: ${isValid}`,
                );
            }

            // Clear logout session data
            await this.sessionService.clearSamlLogoutSession(sessionId);

            // Destroy the entire session
            await this.sessionService.destroySession(req.session);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

            console.log('SAMLController - logoutCallbackGet - SAML SLO completed successfully');
            // Redirect to frontend callback with loggedOut=true parameter
            // The frontend will then navigate to logout-success page
            res.redirect(302, `${frontendUrl}/saml/callback?loggedOut=true`);
        } catch (error) {
            console.error('SAMLController - logoutCallbackGet - error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
            res.redirect(302, `${frontendUrl}/saml/callback?loggedOut=false&error=callback_error`);
        }
    }
}
