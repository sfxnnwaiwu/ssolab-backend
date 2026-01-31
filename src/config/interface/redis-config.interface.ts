export interface RedisConfig {
    host: string;
    port: number;
    password: string;
    username: string;
    tls: boolean;
    max: number;
    ttl: number;
}
