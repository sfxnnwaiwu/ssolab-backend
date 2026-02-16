import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OidcConfiguration } from '../oidc/entities/oidc-configuration.entity';
import { SamlConfiguration } from '../saml/entities/saml-configuration.entity';
import { TestResult } from '../test-results/entities/test-result.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
    imports: [TypeOrmModule.forFeature([SamlConfiguration, OidcConfiguration, TestResult])],
    controllers: [DashboardController],
    providers: [DashboardService],
    exports: [DashboardService],
})
export class DashboardModule {}
