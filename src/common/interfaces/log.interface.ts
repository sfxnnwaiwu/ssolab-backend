export interface RequestLog {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: string;
    duration?: number;
}

export interface ResponseLog {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: string;
}
