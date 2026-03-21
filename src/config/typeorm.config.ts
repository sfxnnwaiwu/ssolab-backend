import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { AppConfig } from './configuration';
import { AppEnvironmentEnum } from './enum/app-environment.enum';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
    private readonly logger = new Logger(TypeOrmConfigService.name);

    constructor(private configService: ConfigService) {}

    createTypeOrmOptions(): TypeOrmModuleOptions {
        const appConfig = this.configService.get<AppConfig>('app');
        const dbConfig = appConfig?.db;

        if (!dbConfig) {
            throw new Error('Database configuration is missing');
        }

        this.logger.log('TypeORM Config - Database Host:', dbConfig.host);
        this.logger.log(`TypeORM Config - Database Port: ${appConfig.app.port}`);
        this.logger.log('TypeORM Config - Database Username:', dbConfig.username);
        this.logger.log('TypeORM Config - Database Name:', dbConfig.databaseName);
        this.logger.log('TypeORM Config - Database Schema:', dbConfig.schema);

        return {
            type: (dbConfig.type || 'postgres') as 'postgres',
            host: dbConfig.host || 'localhost',
            port: dbConfig.port || 5432,
            username: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.databaseName,
            schema: dbConfig.schema || 'public',
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/../migrations/*{.ts,.js}'],
            synchronize: false,
            migrationsRun: true,
            logging:
                appConfig?.env === AppEnvironmentEnum.DEVELOPMENT
                    ? ['error', 'warn', 'migration']
                    : ['error'],
            autoLoadEntities: true,
            retryAttempts: 3,
            retryDelay: 3000,
        };
    }
}
