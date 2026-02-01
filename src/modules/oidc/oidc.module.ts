import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

@Module({
    imports: [SessionModule],
    controllers: [OidcController],
    providers: [OidcService],
    exports: [OidcService],
})
export class OidcModule {}
