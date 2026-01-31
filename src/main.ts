import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppConfigService } from './config/service/app-config.service';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    const logger = app.get(Logger);
    app.useLogger(logger);
    app.useGlobalInterceptors(new LoggerErrorInterceptor());

    const appConfigService = app.get(AppConfigService);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const port = appConfigService.app.port ?? 3000;

    await app.listen(port ?? 3000);

    logger.log(`🚀 SCIM Client Service running on http://localhost:${port}`);
    logger.log(`📚 API Documentation: http://0.0.0.0:${port}/docs`);
}
bootstrap().catch((error) => {
    console.log(`Error: ${JSON.stringify(error)}`);
    process.exit(1);
});
