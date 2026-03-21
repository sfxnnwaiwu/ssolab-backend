export interface HttpLogEntry {
    correlationId: string;
    timestamp: string;
    request: {
        method: string;
        url: string;
        headers: Record<string, unknown>;
        body?: Record<string, unknown> | unknown[];
        query?: Record<string, unknown>;
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        timestamp: string;
    };
    duration: number;
}
