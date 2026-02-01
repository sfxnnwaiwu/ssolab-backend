import { Module } from '@nestjs/common';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';

@Module({
    controllers: [SamlController],
    providers: [SamlService],
    exports: [SamlService],
})
export class SamlModule {}
