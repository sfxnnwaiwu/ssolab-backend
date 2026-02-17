import { config } from 'dotenv';
config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RedisStore } from 'connect-redis';
import * as cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import * as session from 'express-session';
import helmet from 'helmet';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { createClient } from 'redis';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppConfigService } from './config/service/app-config.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    const logger = app.get(Logger);
    app.useLogger(logger);
    app.useGlobalInterceptors(new LoggerErrorInterceptor());
    app.useGlobalInterceptors(new LoggingInterceptor());

    const appConfigService = app.get(AppConfigService);

    // Configure Helmet for security headers
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                },
            },
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
            },
        }),
    );

    // Configure cookie parser for JWT refresh tokens
    app.use(cookieParser());

    // Configure CORS
    app.enableCors({
        origin: [process.env.FRONTEND_URL || 'http://localhost:4200'],
        credentials: true,
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Configure Redis client for sessions
    const redisClient = createClient({
        // socket: {
        //     host: appConfigService.redis.host,
        //     port: appConfigService.redis.port,
        // },
        // password: appConfigService.redis.password || undefined,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    // redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect().catch((err) => {
        logger.error('Redis Client Connection Error', err);
    });

    // Configure session middleware
    const redisStore = new RedisStore({
        client: redisClient,
        prefix: 'session:',
    });

    app.use(
        session({
            store: redisStore,
            genid: () => randomUUID(),
            secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            name: process.env.SESSION_COOKIE_NAME || 'connect.sid',
            cookie: {
                httpOnly: true, // Always true for security
                secure: process.env.NODE_ENV === 'production', // true in production
                sameSite: 'lax',
                maxAge: 30 * 60 * 1000, // 30 minutes
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
