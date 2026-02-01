import { ErrorDetail } from '../../../common/interfaces/error-detail.interface';
import { RequestLog, ResponseLog } from '../../../common/interfaces/log.interface';

export interface SamlAuthResult {
    success: true;
    protocol: 'saml';
    timestamp: string;
    samlResponse: {
        decoded: {
            issuer: string;
            subject: string;
            sessionIndex: string;
            conditions: {
                notBefore: string;
                notOnOrAfter: string;
                audience: string;
            };
        };
        raw: string;
    };
    userAttributes: Record<string, string | string[]>;
    requestLog: RequestLog;
    responseLog: ResponseLog;
}

export interface SamlErrorResult {
    success: false;
    protocol: 'saml';
    error: ErrorDetail;
    requestLog: RequestLog;
    responseLog: ResponseLog;
}

export type SamlResult = SamlAuthResult | SamlErrorResult;
