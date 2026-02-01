import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Req,
    Res,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SamlConfigResponse } from './interfaces/saml-config.interface';
import { SamlService } from './saml.service';

@Controller('api/saml')
export class SamlController {
    constructor(private readonly samlService: SamlService) {}

    /**
     * POST /api/saml/config
     * Store SAML IdP configuration for authentication flow
     */
    @Post('config')
    @HttpCode(HttpStatus.CREATED)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async storeConfig(@Body() configDto: SamlConfigDto): Promise<SamlConfigResponse> {
        return this.samlService.storeConfig(configDto);
    }

    /**
     * GET /api/saml/login/:configId
     * Initiate SAML authentication flow
     */
    @Get('login/:configId')
    async login(@Param('configId') configId: string, @Res() res: Response) {
        try {
            const redirectUrl = await this.samlService.generateAuthnRequest(configId);

            // Redirect to IdP SSO URL with SAMLRequest
            return res.redirect(302, redirectUrl);
        } catch (error) {
            throw new NotFoundException(error.message);
        }
    }

    /**
     * POST /api/saml/callback
     * Handle SAML response from IdP
     */
    @Post('callback')
    async callback(
        @Body('SAMLResponse') samlResponse: string,
        @Body('RelayState') relayState: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const result = await this.samlService.validateSamlResponse(samlResponse, relayState);

        // Store result in session
        req.session.authResult = result;

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        if (result.success) {
            // Redirect to frontend with success parameter
            return res.redirect(302, `${frontendUrl}/saml/callback?success=true`);
        } else {
            // Redirect to frontend with error parameter
            return res.redirect(302, `${frontendUrl}/saml/callback?error=${result.error.type}`);
        }
    }
}
