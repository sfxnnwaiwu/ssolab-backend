import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DetailedHttpException } from '../exceptions/detailed-http.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const errorResponse = this.buildErrorResponse(exception, request, status);
        this.logError(exception, request, status);
        response.status(status).json(errorResponse);
    }

    private buildErrorResponse(exception: unknown, request: Request, status: number) {
        if (exception instanceof DetailedHttpException) {
            return {
                success: false,
                error: exception.errorDetail,
                timestamp: new Date().toISOString(),
                path: request.url,
                method: request.method,
            };
        }

        return {
            success: false,
            error: {
                type: this.getErrorType(status),
                title: this.getErrorTitle(status),
                description: this.getErrorDescription(exception),
                technicalDetails: this.getTechnicalDetails(exception),
                troubleshootingSteps: this.getTroubleshootingSteps(status),
            },
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...(process.env.NODE_ENV !== 'production' &&
                exception instanceof Error && {
                    stack: exception.stack,
                }),
        };
    }

    private getErrorType(status: HttpStatus): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'bad_request';
            case HttpStatus.UNAUTHORIZED:
                return 'unauthorized';
            case HttpStatus.FORBIDDEN:
                return 'forbidden';
            case HttpStatus.NOT_FOUND:
                return 'not_found';
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return 'internal_server_error';
            default:
                return 'unknown_error';
        }
    }

    private getErrorTitle(status: HttpStatus): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'Bad Request';
            case HttpStatus.UNAUTHORIZED:
                return 'Unauthorized';
            case HttpStatus.FORBIDDEN:
                return 'Forbidden';
            case HttpStatus.NOT_FOUND:
                return 'Not Found';
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return 'Internal Server Error';
            default:
                return 'An Error Occurred';
        }
    }

    private getErrorDescription(exception: unknown): string {
        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            if (typeof response === 'string') {
                return response;
            }

            if (typeof response === 'object' && 'message' in response) {
                const message = response.message;
                return Array.isArray(message) ? message.join(', ') : JSON.stringify(response);
            }
        }

        if (exception instanceof Error) {
            return exception.message;
        }

        return 'An unexpected error occurred';
    }

    private getTechnicalDetails(exception: unknown): string {
        if (exception instanceof Error) {
            return `${exception.name}: ${exception.message}`;
        }
        return String(exception);
    }

    private getTroubleshootingSteps(status: HttpStatus): string[] {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return [
                    'Check that all required fields are provided',
                    'Verify the request body matches the expected format',
                    'Ensure all values meet validation requirements',
                    'Review the API documentation for correct parameter types',
                ];
            case HttpStatus.UNAUTHORIZED:
                return [
                    'Verify your authentication credentials are correct',
                    'Check if your session has expired',
                    'Ensure you have the necessary permissions',
                    'Try logging out and logging back in',
                ];
            case HttpStatus.NOT_FOUND:
                return [
                    'Verify the resource ID or identifier is correct',
                    'Check if the resource exists in the system',
                    'Ensure you are using the correct endpoint URL',
                    'Review the API documentation for available resources',
                ];
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return [
                    'Try the request again in a few moments',
                    'Contact support if the issue persists',
                    'Check the system status page for known issues',
                    'Review server logs for more details',
                ];
            default:
                return [
                    'Review the error message for specific details',
                    'Check the API documentation for guidance',
                    'Contact support if you need assistance',
                ];
        }
    }

    private logError(exception: unknown, request: Request, status: HttpStatus) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.url,
            status,
            errorType: exception instanceof Error ? exception.name : 'UnknownError',
            message: exception instanceof Error ? exception.message : String(exception),
            correlationId: request.headers['x-request-id'] || 'N/A',
            ...(exception instanceof Error && { stack: exception.stack }),
        };

        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(errorLog);
        } else if (status >= HttpStatus.BAD_REQUEST) {
            this.logger.warn(errorLog);
        } else {
            this.logger.log(errorLog);
        }
    }
}
