import { CacheModule } from '@nestjs/cache-manager';
import { Module, RequestMethod } from '@nestjs/common';
import { redisStore } from 'cache-manager-redis-yet';
import { LoggerModule } from 'nestjs-pino/LoggerModule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.nodule';
import { getPinoHttpOptions } from './config/logger/pino-http-options';
import { AppConfigService } from './config/service/app-config.service';
import { OidcModule } from './modules/oidc/oidc.module';
import { SamlModule } from './modules/saml/saml.module';
import { SessionModule } from './modules/session/session.module';

@Module({
    imports: [
        AppConfigModule,
        LoggerModule.forRootAsync({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => ({
                pinoHttp: getPinoHttpOptions(config),
                exclude: [{ method: RequestMethod.ALL, path: 'health' }],
            }),
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            inject: [AppConfigService],
            useFactory: async (config: AppConfigService) => {
                const store = await redisStore({
                    socket: {
                        host: config.redis.host,
                        port: config.redis.port,
                    },
                    password: config.redis.password || undefined,
                    ttl: config.redis.ttl,
                });
                return {
                    store: () => store,
                };
            },
        }),
        SamlModule,
        SessionModule,
        OidcModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
