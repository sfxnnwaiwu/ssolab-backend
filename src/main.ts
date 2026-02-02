import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RedisStore } from 'connect-redis';
import * as session from 'express-session';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { createClient } from 'redis';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfigService } from './config/service/app-config.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    const logger = app.get(Logger);
    app.useLogger(logger);
    app.useGlobalInterceptors(new LoggerErrorInterceptor());

    const appConfigService = app.get(AppConfigService);

    // Configure CORS
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        credentials: true,
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Configure Redis client for sessions
    const redisClient = createClient({
        socket: {
            host: appConfigService.redis.host,
            port: appConfigService.redis.port,
        },
        password: appConfigService.redis.password || undefined,
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect();

    // Configure session middleware
    const redisStore = new RedisStore({
        client: redisClient,
        prefix: 'session:',
    });

    app.use(
        session({
            store: redisStore,
            secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            name: process.env.SESSION_COOKIE_NAME || 'connect.sid',
            cookie: {
                httpOnly: process.env.SESSION_COOKIE_HTTP_ONLY !== 'false',
                secure: process.env.SESSION_COOKIE_SECURE === 'true',
                sameSite:
                    (process.env.SESSION_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
                maxAge: parseInt(process.env.SESSION_TTL || '1800', 10) * 1000, // Convert seconds to ms
            },
        }),
    );

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

    app.useGlobalFilters(new AllExceptionsFilter());

    const port = appConfigService.app.port ?? 3000;

    await app.listen(port);

    logger.log(`🚀 SCIM Client Service running on http://localhost:${port}`);
    logger.log(`📚 API Documentation: http://0.0.0.0:${port}/docs`);
}
bootstrap().catch((error) => {
    console.log(`Error: ${JSON.stringify(error)}`);
    process.exit(1);
});
