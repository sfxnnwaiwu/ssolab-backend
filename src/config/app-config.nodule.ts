import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { AppConfigService } from './app-config.service';
import Configuration from './configuration';
import { AppConfigService } from './service/app-config.service';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // ignoreEnvFile: true, // Environment variables already loaded in main.ts
            load: [Configuration],
            // validationSchema: AppConfigValidationSchema,
            validationOptions: {
                allowUnknown: true,
                abortEarly: false,
            },
        }),
    ],
    providers: [AppConfigService],
    exports: [AppConfigService],
})
export class AppConfigModule {}
