import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { OidcConfigResponse } from './interfaces/oidc-config.interface';
import { OidcService } from './oidc.service';

@Controller('api/oidc')
export class OidcController {
    private readonly logger = new Logger(OidcController.name);

    constructor(private readonly oidcService: OidcService) {}

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
}
