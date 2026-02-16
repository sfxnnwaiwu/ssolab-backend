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
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { SAML_ERROR_DETAILS } from '../../common/constants/saml-errors.constant';
import { DetailedHttpException } from '../../common/exceptions/detailed-http.exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SamlConfigResponse } from './interfaces/saml-config.interface';
import { SamlService } from './saml.service';
import { SamlAuthResult } from './interfaces/saml-auth-result.interface';
import { ErrorAuthResult } from '../session/interfaces/auth-result.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SessionService } from '../session/session.service';

interface RelayStateData {
    configId: string;
    userId: string;
    timestamp: number;
}

@Controller('api/saml')
export class SamlController {
    constructor(
        private readonly samlService: SamlService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly sessionService: SessionService,
    ) {}

    /**
     * POST /api/saml/config
     * Store SAML IdP configuration for authentication flow
     */
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

    /**
     * GET /api/saml/login/:configId
     * Initiate SAML authentication flow
     */
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

    /**
     * POST /api/saml/validate
     * Validate SAML response from IdP (called by frontend)
     */
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

    /**
     * POST /api/saml/callbacks
     * Handle SAML response from IdP
     */
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
}
