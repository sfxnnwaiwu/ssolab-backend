import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

config();

const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'sso_test',
    schema: process.env.DATABASE_SCHEMA || 'public',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
};

export default new DataSource(dataSourceOptions);
