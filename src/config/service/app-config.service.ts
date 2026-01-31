import { Inject, Injectable } from '@nestjs/common';
import { AppEnvironmentEnum } from '../enum/app-environment.enum';
import { DbConfig } from '../interface/db-config.interface';
import { PortConfig } from '../interface/port-config.interface';
import type { ConfigType } from '@nestjs/config';
import AppConfiguration from '../configuration';
import { RabbitMQConfig } from '../interface/rabbitmw-config.interface';
import { RedisConfig } from '../interface/redis-config.interface';

@Injectable()
export class AppConfigService {
    constructor(
        @Inject(AppConfiguration.KEY)
        private config: ConfigType<typeof AppConfiguration>,
    ) {}

    get env(): AppEnvironmentEnum {
        return this.config.env;
    }

    get isDevelopmentEnv(): boolean {
        return this.config.env === AppEnvironmentEnum.DEVELOPMENT;
    }

    get isLocalEnv(): boolean {
        return this.config.env === AppEnvironmentEnum.LOCAL;
    }

    get isProductionEnv(): boolean {
        return this.config.env === AppEnvironmentEnum.PRODUCTION;
    }

    get db(): DbConfig {
        return this.config.db;
    }

    get app(): PortConfig {
        return this.config.app;
    }

    get rabbitMQ(): RabbitMQConfig {
        return this.config.rabbitMQ;
    }

    get redis(): RedisConfig {
        return this.config.redis;
    }
}
