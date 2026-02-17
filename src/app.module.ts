import { CacheModule } from '@nestjs/cache-manager';
import { Module, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-yet';
import { LoggerModule } from 'nestjs-pino/LoggerModule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.nodule';
import { getPinoHttpOptions } from './config/logger/pino-http-options';
import { AppConfigService } from './config/service/app-config.service';
import { TypeOrmConfigService } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { OidcModule } from './modules/oidc/oidc.module';
import { SamlModule } from './modules/saml/saml.module';
import { SessionModule } from './modules/session/session.module';

@Module({
    imports: [
        AppConfigModule,
        TypeOrmModule.forRootAsync({
            imports: [AppConfigModule],
            useClass: TypeOrmConfigService,
        }),
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60000, // 1 minute
                limit: 100, // 100 requests per minute
            },
            {
                name: 'strict',
                ttl: 900000, // 15 minutes
                limit: 20, // 20 requests per 15 minutes for login endpoints
            },
        ]),
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
                    // socket: {
                    //     host: config.redis.host,
                    //     port: config.redis.port,
                    // },
                    // password: config.redis.password || undefined,
                    // ttl: config.redis.ttl,
                    url: config.redis.url || 'redis://localhost:6379',
                });
                return {
                    store: () => store,
                };
            },
        }),
        AuthModule,
        SamlModule,
        OidcModule,
        SessionModule,
        DashboardModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}
