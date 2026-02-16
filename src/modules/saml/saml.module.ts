import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestResult } from '../test-results/entities/test-result.entity';
import { SamlConfiguration } from './entities/saml-configuration.entity';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { SessionService } from '../session/session.service';

@Module({
    imports: [TypeOrmModule.forFeature([SamlConfiguration, TestResult])],
    controllers: [SamlController],
    providers: [SamlService, SessionService],
    exports: [SamlService],
})
export class SamlModule {}
