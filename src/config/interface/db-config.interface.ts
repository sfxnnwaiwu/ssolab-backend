export interface DbConfig {
    type: DbType;
    host: string;
    port: number;
    username: string;
    password: string;
    databaseName: string;
    schema: string;
}
export type DbType = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'mssql';
