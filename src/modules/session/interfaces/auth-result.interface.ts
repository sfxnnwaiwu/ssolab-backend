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

export interface ErrorDetail {
    type: string;
    title: string;
    description: string;
    technicalDetails: string;
    troubleshootingSteps: string[];
    relatedDocs?: Array<{
        title: string;
        url: string;
    }>;
}

export interface OidcAuthResult {
    success: true;
    timestamp: string;
    tokens: {
        idToken: {
            raw: string;
            decoded: {
                header: Record<string, any>;
                payload: Record<string, any>;
                signature: string;
            };
        };
        accessToken: {
            raw: string;
            decoded?: Record<string, any>;
        };
        refreshToken?: {
            raw: string;
            decoded?: Record<string, any>;
        };
        expiresIn: number;
        tokenType: string;
    };
    userClaims: Record<string, any>;
    requestLog: RequestLog;
    responseLog: ResponseLog;
}

export interface ErrorAuthResult {
    success: false;
    error: ErrorDetail;
    requestLog: RequestLog;
    responseLog: ResponseLog;
}

export type AuthResult = OidcAuthResult | ErrorAuthResult;
