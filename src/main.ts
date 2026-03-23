import { config } from 'dotenv';
config();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:4200',
        'http://localhost:4200',
        'http://localhost:3000',
    ];

    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        exposedHeaders: ['Set-Cookie', 'Content-Range', 'X-Content-Range'],
        maxAge: 3600,
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
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 30 * 60 * 1000,
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

    // Configure Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
        .setTitle('SSO Test Backend API')
        .setDescription(
            'Comprehensive Single Sign-On (SSO) testing backend API with support for OIDC and SAML authentication flows',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .addTag('Authentication', 'User signup, login, logout, and token refresh endpoints')
        .addTag('OIDC SSO', 'OpenID Connect authentication flow endpoints')
        .addTag('SAML SSO', 'SAML 2.0 authentication flow endpoints')
        .addTag('Session', 'Session management and debug endpoints')
        .addTag('Dashboard', 'User dashboard and configuration management')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
            operationsSorter: 'method',
        },
    });

    const port = appConfigService.app.port ?? 3000;

    await app.listen(port);

    logger.log(`🚀 SSO Test Backend running on http://localhost:${port}`);

    logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap().catch((error) => {
    console.log(`Error: ${JSON.stringify(error)}`);
    process.exit(1);
});
