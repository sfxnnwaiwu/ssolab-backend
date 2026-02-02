import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { SensitiveDataRedactor } from '../utils/sensitive-data-redactor';

export interface HttpLogEntry {
    correlationId: string;
    timestamp: string;
    request: {
        method: string;
        url: string;
        headers: Record<string, unknown>;
        body?: Record<string, unknown>;
        query?: Record<string, unknown>;
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        timestamp: string;
    };
    duration: number;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        const correlationId =
            (request.headers['x-correlation-id'] as string) ||
            (request.headers['x-request-id'] as string) ||
            uuidv4();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (request as any).correlationId = correlationId;
        response.setHeader('X-Correlation-ID', correlationId);

        const startTime = Date.now();
        const requestTimestamp = new Date().toISOString();

        const requestLog = {
            correlationId,
            timestamp: requestTimestamp,
            method: request.method,
            url: request.url,
            headers: SensitiveDataRedactor.redactHeaders(request.headers) as Record<
                string,
                unknown
            >,
            body: request.body
                ? (SensitiveDataRedactor.redact(request.body) as Record<string, unknown>)
                : undefined,
            query: request.query
                ? (SensitiveDataRedactor.redact(request.query) as Record<string, unknown>)
                : undefined,
        };

        this.logger.log({
            type: 'REQUEST',
            ...requestLog,
        });

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                const responseTimestamp = new Date().toISOString();

                const responseLog = {
                    correlationId,
                    timestamp: responseTimestamp,
                    method: request.method,
                    url: request.url,
                    statusCode: response.statusCode,
                    duration,
                    headers: SensitiveDataRedactor.redactHeaders(response.getHeaders()) as Record<
                        string,
                        unknown
                    >,
                };

                this.logger.log({
                    type: 'RESPONSE',
                    ...responseLog,
                });

                this.storeLogInSession(request, {
                    correlationId,
                    timestamp: requestTimestamp,
                    request: {
                        method: request.method,
                        url: request.url,
                        headers: SensitiveDataRedactor.redactHeaders(request.headers) as Record<
                            string,
                            unknown
                        >,
                        body: request.body
                            ? (SensitiveDataRedactor.redact(request.body) as Record<
                                  string,
                                  unknown
                              >)
                            : undefined,
                        query: request.query
                            ? (SensitiveDataRedactor.redact(request.query) as Record<
                                  string,
                                  unknown
                              >)
                            : undefined,
                    },
                    response: {
                        statusCode: response.statusCode,
                        headers: SensitiveDataRedactor.redactHeaders(
                            response.getHeaders(),
                        ) as Record<string, unknown>,
                        timestamp: responseTimestamp,
                    },
                    duration,
                });
            }),
            catchError((error: unknown) => {
                const duration = Date.now() - startTime;
                const responseTimestamp = new Date().toISOString();
                const err = error as { status?: number; message?: string };

                const errorLog = {
                    correlationId,
                    timestamp: responseTimestamp,
                    method: request.method,
                    url: request.url,
                    statusCode: err.status ?? 500,
                    duration,
                    error: err.message ?? 'Unknown error',
                };

                this.logger.error({
                    type: 'ERROR_RESPONSE',
                    ...errorLog,
                });

                this.storeLogInSession(request, {
                    correlationId,
                    timestamp: requestTimestamp,
                    request: {
                        method: request.method,
                        url: request.url,
                        headers: SensitiveDataRedactor.redactHeaders(request.headers) as Record<
                            string,
                            unknown
                        >,
                        body: request.body
                            ? (SensitiveDataRedactor.redact(request.body) as Record<
                                  string,
                                  unknown
                              >)
                            : undefined,
                        query: request.query
                            ? (SensitiveDataRedactor.redact(request.query) as Record<
                                  string,
                                  unknown
                              >)
                            : undefined,
                    },
                    response: {
                        statusCode: err.status ?? 500,
                        headers: {},
                        timestamp: responseTimestamp,
                    },
                    duration,
                });

                return throwError(() => error);
            }),
        );
    }

    private storeLogInSession(request: Request, logEntry: HttpLogEntry): void {
        try {
            if (!request.session) {
                return;
            }

            if (!request.session.logs) {
                request.session.logs = [];
            }

            request.session.logs.push(logEntry);

            if (request.session.logs.length > 10) {
                request.session.logs = request.session.logs.slice(-10);
            }
        } catch (error) {
            const err = error as { message?: string };
            this.logger.warn(`Failed to store log in session: ${err.message ?? 'Unknown error'}`);
        }
    }
}
