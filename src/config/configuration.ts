import { registerAs } from '@nestjs/config';
import { AppEnvironmentEnum } from './enum/app-environment.enum';
import { DbConfig, DbType } from './interface/db-config.interface';
import { PortConfig } from './interface/port-config.interface';
import { RabbitMQConfig } from './interface/rabbitmw-config.interface';
import { RedisConfig } from './interface/redis-config.interface';

export class AppConfig {
    env: AppEnvironmentEnum =
        (process.env.NODE_ENV as AppEnvironmentEnum) || AppEnvironmentEnum.DEVELOPMENT;

    db: DbConfig = {
        type: process.env.FIXIAM_DATABASE_TYPE as DbType,
        host: process.env.FIXIAM_DATABASE_HOST as string,
        port: parseInt(process.env.FIXIAM_DATABASE_PORT as string),
        username: process.env.FIXIAM_DATABASE_USERNAME as string,
        password: process.env.FIXIAM_DATABASE_PASSWORD as string,
        databaseName: process.env.FIXIAM_DATABASE_NAME as string,
        schema: process.env.FIXIAM_DATABASE_SCHEMA as string,
    };

    app: PortConfig = {
        port: Number.parseInt(process.env.PORT || '3000', 10),
    };

    rabbitMQ: RabbitMQConfig = {
        user: process.env.RABBITMQ_USER as string,
        password: process.env.RABBITMQ_PASSWORD as string,
        host: process.env.RABBITMQ_HOST as string,
        port: Number.parseInt(process.env.RABBITMQ_PORT as string, 10) || 5672,
        queueName: process.env.RABBITMQ_QUEUE_NAME as string,
        uriScheme: process.env.RABBITMQ_URI_SCHEME as string,
    };

    redis: RedisConfig = {
        host: (process.env.REDIS_HOST as string) || '127.0.0.1',
        port: Number.parseInt(process.env.REDIS_PORT as string, 10) || 6379,
        username: (process.env.REDIS_USERNAME as string) || '',
        password: (process.env.REDIS_PASSWORD as string) || '',
        tls: process.env.REDIS_TLS === 'true',
        max: Number.parseInt(process.env.CACHE_MAX_ITEMS as string, 10) || 1000,
        ttl: Number.parseInt(process.env.CACHE_TTL as string, 10) || 60000,
    };
}

export const config = new AppConfig();

export default registerAs('app', () => config);
