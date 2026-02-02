# US-B006 Implementation Summary: Request/Response Logging

## Overview

Successfully implemented comprehensive request/response logging for the SSO Test Backend following the requirements in BACKEND_PRD.md. This implementation provides detailed HTTP logging with sensitive data redaction, correlation ID tracking, and session-based log storage for debugging authentication flows.

## Implementation Status

✅ **COMPLETED** - All acceptance criteria met and build successful

## Files Created/Modified

### New Files Created:

1. **src/common/utils/sensitive-data-redactor.ts** (101 lines)
    - Static utility class for redacting sensitive data from logs
    - Handles full redaction of sensitive fields (passwords, tokens, secrets)
    - Partial redaction for SAML responses (first 50 characters)
    - Recursive redaction for nested objects and arrays
    - Specialized header redaction for authorization, cookies, tokens

2. **src/common/interceptors/logging.interceptor.ts** (177 lines)
    - NestJS interceptor implementing comprehensive HTTP logging
    - Generates or uses correlation IDs for request tracking
    - Logs all requests and responses with structured data
    - Stores last 10 log entries per session
    - Handles both successful responses and errors
    - Includes request duration in milliseconds

### Files Modified:

1. **src/modules/session/session.controller.ts**
    - Added new endpoint: `GET /api/session/logs`
    - Returns logs array and count from session
    - Allows frontend to retrieve HTTP logs for debugging

2. **src/types/session.d.ts**
    - Added `HttpLogEntry[]` type to SessionData interface
    - Extended session to support logs array storage

3. **src/main.ts**
    - Added import for LoggingInterceptor
    - Registered LoggingInterceptor globally after LoggerErrorInterceptor

## Acceptance Criteria Status

✅ **AC1**: All HTTP requests are logged with method, URL, headers, body

- Request log includes: method, URL, headers (redacted), body (redacted), query (redacted)
- Logged on every HTTP request

✅ **AC2**: All HTTP responses are logged with status, headers, timestamp

- Response log includes: status code, headers (redacted), timestamp
- Logged on every HTTP response (success and error)

✅ **AC3**: Logs include correlation IDs for request tracking

- Correlation ID generated using UUID v4 if not provided
- Supports `x-correlation-id` and `x-request-id` headers
- Correlation ID included in both request and response logs
- Added to response headers for client tracking

✅ **AC4**: Sensitive data (passwords, tokens) are redacted in logs

- Fully redacted fields: password, clientSecret, secret, token, accessToken, refreshToken, idToken, authorization, cookie
- Partially redacted: SAMLResponse (first 50 chars visible)
- Recursive redaction for nested objects
- Header-specific redaction logic

✅ **AC5**: Logs are stored with authentication result in session

- Last 10 log entries stored per session
- Automatic cleanup (FIFO - oldest logs removed)
- Stored in Redis via express-session

✅ **AC6**: Frontend can retrieve logs via session API

- New endpoint: `GET /api/session/logs`
- Returns structured response with logs array and count
- No authentication required (session-based)

## Technical Implementation Details

### Correlation ID Flow

1. **Generation**:
    - Check for `x-correlation-id` header
    - Fallback to `x-request-id` header
    - Generate new UUID v4 if neither present

2. **Storage**:
    - Attached to request object as `correlationId` property
    - Added to response headers as `X-Correlation-ID`

3. **Usage**:
    - Included in all log entries (request, response, error)
    - Enables tracing a single request through the entire flow

### Sensitive Data Redaction

**Fully Redacted Fields:**

```typescript
[
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
```

**Partially Redacted Fields:**

```typescript
['SAMLResponse', 'samlResponse']; // Shows first 50 characters + "... [TRUNCATED]"
```

**Redaction Example:**

```json
{
    "clientId": "my-client-id",
    "clientSecret": "[REDACTED]",
    "SAMLResponse": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTg/... [TRUNCATED]"
}
```

### Log Entry Structure

```typescript
interface HttpLogEntry {
    correlationId: string;
    timestamp: string;
    request: {
        method: string;
        url: string;
        headers: any; // Redacted
        body?: any; // Redacted
        query?: any; // Redacted
    };
    response: {
        statusCode: number;
        headers: any; // Redacted
        timestamp: string;
    };
    duration: number; // milliseconds
}
```

### Session Storage

- **Storage Location**: Redis via express-session
- **Key**: Session ID (managed by express-session)
- **Maximum Entries**: 10 per session (last 10)
- **Cleanup Strategy**: FIFO (First In, First Out)
- **Data Structure**: Array of HttpLogEntry objects

### Logging Flow

1. **Request Received**:
    - Generate/retrieve correlation ID
    - Add correlation ID to request object
    - Set correlation ID in response headers
    - Log request details (with redaction)

2. **Response Sent**:
    - Calculate request duration
    - Log response details (with redaction)
    - Store complete log entry in session

3. **Error Occurred**:
    - Calculate request duration
    - Log error response
    - Store error log entry in session

### API Endpoints

#### GET /api/session/logs

Retrieves HTTP logs stored in the session.

**Request:**

```http
GET /api/session/logs HTTP/1.1
Cookie: connect.sid=<session-id>
```

**Response:**

```json
{
    "logs": [
        {
            "correlationId": "123e4567-e89b-12d3-a456-426614174000",
            "timestamp": "2024-01-01T12:00:00.000Z",
            "request": {
                "method": "POST",
                "url": "/api/saml/config",
                "headers": {
                    "content-type": "application/json",
                    "authorization": "[REDACTED]"
                },
                "body": {
                    "idpName": "My IdP",
                    "certificate": "-----BEGIN CERTIFICATE-----..."
                }
            },
            "response": {
                "statusCode": 201,
                "headers": {
                    "content-type": "application/json",
                    "x-correlation-id": "123e4567-e89b-12d3-a456-426614174000"
                },
                "timestamp": "2024-01-01T12:00:00.123Z"
            },
            "duration": 123
        }
    ],
    "count": 1
}
```

## Integration with Existing Features

### Works Seamlessly With:

1. **Pino Logger**: Uses NestJS Logger (configured with Pino) for structured logging
2. **Express Session**: Integrates with existing session middleware
3. **Error Handling**: Logs errors through AllExceptionsFilter
4. **SAML/OIDC Flows**: Captures all authentication-related requests

### Interceptor Order:

```typescript
app.useGlobalInterceptors(new LoggerErrorInterceptor()); // Pino error logging
app.useGlobalInterceptors(new LoggingInterceptor()); // HTTP request/response logging
```

## Build & Test Results

✅ **Build Status**: SUCCESSFUL

- No TypeScript compilation errors
- All imports resolved correctly
- All type definitions valid

✅ **Test Status**: PASSING

- All existing tests continue to pass
- No breaking changes introduced

## Security Considerations

### What Gets Redacted:

✅ Passwords and secrets
✅ OAuth/OIDC tokens (access, refresh, ID tokens)
✅ Authorization headers
✅ Cookies and Set-Cookie headers
✅ Client secrets
✅ Full SAML responses (partial redaction showing first 50 chars)

### What Remains Visible:

✅ Request methods and URLs
✅ Status codes
✅ Non-sensitive headers (content-type, accept, etc.)
✅ Non-sensitive request/response body fields
✅ Timestamps and durations
✅ Correlation IDs

## Performance Considerations

- **Overhead**: Minimal - logging happens asynchronously via RxJS observables
- **Session Storage**: Only last 10 entries kept (prevents memory bloat)
- **Redis Storage**: Session data automatically expires per TTL (default 30 min)
- **Redaction**: Efficient recursive algorithm with no deep cloning

## Usage Examples

### Debugging Authentication Flow

1. User initiates SAML login
2. Frontend calls `POST /api/saml/config`
3. LoggingInterceptor logs request with correlation ID
4. Response logged with same correlation ID
5. Frontend can call `GET /api/session/logs` to see entire flow
6. Developer can trace specific request using correlation ID

### Tracing Specific Request

```bash
# Request with custom correlation ID
curl -H "X-Correlation-ID: my-trace-id" http://localhost:3000/api/saml/config

# Response includes same ID
# X-Correlation-ID: my-trace-id

# Check logs in server output for "my-trace-id"
```

## Known Limitations

None at this time. The implementation meets all acceptance criteria and provides comprehensive HTTP logging with proper security through sensitive data redaction.

## Next Steps

1. **US-B007: Session Management**
    - Already partially implemented (sessions are working)
    - May need to verify Redis TTL configuration
    - Ensure session cookie security settings

2. **US-B008: Security Hardening**
    - Configure Helmet middleware
    - Implement rate limiting
    - Add CSRF protection

## Summary

US-B006 Request/Response Logging has been successfully implemented with:

- ✅ Comprehensive HTTP request/response logging
- ✅ Sensitive data redaction (15+ field types)
- ✅ Correlation ID tracking (UUID v4)
- ✅ Session-based log storage (last 10 entries)
- ✅ Frontend API for log retrieval
- ✅ Integration with Pino structured logging
- ✅ Request duration tracking
- ✅ Build successful
- ✅ All tests passing
- ✅ Ready for production use
