/**
 * Redacts sensitive data from objects for logging purposes
 * Handles nested objects and arrays
 */
export class SensitiveDataRedactor {
    private static readonly SENSITIVE_FIELDS = [
        'password',
        'clientSecret',
        'client_secret',
        'secret',
        'token',
        'accessToken',
        'access_token',
        'refreshToken',
        'refresh_token',
        'idToken',
        'id_token',
        'authorization',
        'cookie',
        'set-cookie',
    ];

    private static readonly PARTIAL_REDACT_FIELDS = ['SAMLResponse', 'samlResponse'];

    /**
     * Redacts sensitive fields from an object
     * @param obj Object to redact
     * @returns New object with sensitive fields redacted
     */
    static redact(obj: Record<string, unknown> | unknown[]): Record<string, unknown> | unknown[] {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => {
                if (item && typeof item === 'object') {
                    return this.redact(item as Record<string, unknown>);
                }
                return item;
            });
        }

        const redacted: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();

            // Check if this is a sensitive field that should be fully redacted
            if (this.SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
                redacted[key] = '[REDACTED]';
                continue;
            }

            // Check if this is a field that should be partially redacted (show first 50 chars)
            if (
                this.PARTIAL_REDACT_FIELDS.some((field) => lowerKey === field.toLowerCase()) &&
                typeof value === 'string'
            ) {
                redacted[key] =
                    value.length > 50 ? `${value.substring(0, 50)}... [TRUNCATED]` : value;
                continue;
            }

            // Recursively redact nested objects
            if (value && typeof value === 'object') {
                redacted[key] = this.redact(value as Record<string, unknown>);
            } else {
                redacted[key] = value;
            }
        }

        return redacted;
    }

    /**
     * Redacts sensitive headers from request/response headers
     * @param headers Headers object
     * @returns Redacted headers object
     */
    static redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
        if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
            return {};
        }

        const redacted: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();

            if (
                lowerKey === 'authorization' ||
                lowerKey === 'cookie' ||
                lowerKey === 'set-cookie' ||
                lowerKey.includes('token')
            ) {
                redacted[key] = '[REDACTED]';
            } else {
                redacted[key] = value;
            }
        }

        return redacted;
    }
}
