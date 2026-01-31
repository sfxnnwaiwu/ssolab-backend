import { Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getPinoHttpOptions } from './config/logger/pino-http-options';
import { AppConfigService } from './config/service/app-config.service';
import { LoggerModule } from 'nestjs-pino/LoggerModule';
import { AppConfigModule } from './config/app-config.nodule';

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
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
