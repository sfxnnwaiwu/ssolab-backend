export interface RabbitMQConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    queueName: string;
    uriScheme: string;
}
