import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../session/session.module';
import { TestResult } from '../test-results/entities/test-result.entity';
import { OidcConfiguration } from './entities/oidc-configuration.entity';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

@Module({
    imports: [TypeOrmModule.forFeature([OidcConfiguration, TestResult]), SessionModule],
    controllers: [OidcController],
    providers: [OidcService],
    exports: [OidcService],
})
export class OidcModule {}
