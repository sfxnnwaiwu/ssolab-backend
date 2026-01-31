export interface HttpLog {
    req?: {
        id: string;
        method: string;
        url: string;
        remoteAddress: string;
    };
    res?: {
        statusCode: number;
    };
    context?: string;
    responseTime?: number;
    msg?: string;
    message?: string;
    level?: number;
    time?: number;
    pid?: number;
    hostname?: string;
}
