import { ApiProperty } from '@nestjs/swagger';

export class OidcConfig {
    @ApiProperty({
        description: 'OIDC Client ID',
        example: '123456789.apps.googleusercontent.com',
    })
    clientId: string;

    @ApiProperty({
        description: 'OIDC Client Secret',
        example: 'GOCSPX-aBcDeFgHiJkLmNoPqRsT',
    })
    clientSecret: string;

    @ApiProperty({
        description: 'OpenID Provider Configuration URL',
        example: 'https://accounts.google.com/.well-known/openid-configuration',
    })
    discoveryUrl: string;

    @ApiProperty({
        description: 'Requested OIDC scopes',
        example: ['openid', 'profile', 'email'],
        type: [String],
    })
    scopes: string[];

    @ApiProperty({
        description: 'Response types',
        example: ['code'],
        type: [String],
    })
    responseType: string[];
}

export class OidcConfigResponse {
    @ApiProperty({
        description: 'Authorization URL to redirect user for OIDC authentication',
        example:
            'https://accounts.google.com/o/oauth2/v2/auth?client_id=...&response_type=code&scope=...',
    })
    url: string;

    @ApiProperty({
        description: 'Configuration ID for this OIDC setup',
        example: 'config_123456',
    })
    configId: string;

    @ApiProperty({
        description: 'Configuration expiration timestamp',
        example: '2026-03-21T15:00:00.000Z',
    })
    expiresAt: string;
}

export class OidcDiscoveryDocument {
    @ApiProperty({
        description: 'OIDC Provider issuer identifier',
        example: 'https://accounts.google.com',
    })
    issuer: string;

    @ApiProperty({
        description: 'Authorization endpoint URL',
        example: 'https://accounts.google.com/o/oauth2/v2/auth',
    })
    authorization_endpoint: string;

    @ApiProperty({
        description: 'Token endpoint URL',
        example: 'https://oauth2.googleapis.com/token',
    })
    token_endpoint: string;

    @ApiProperty({
        description: 'JWKS (JSON Web Key Set) URI for verifying tokens',
        example: 'https://www.googleapis.com/oauth2/v3/certs',
    })
    jwks_uri: string;

    @ApiProperty({
        description: 'User info endpoint URL (optional)',
        example: 'https://openidconnect.googleapis.com/v1/userinfo',
        required: false,
    })
    userinfo_endpoint?: string;

    @ApiProperty({
        description: 'End session (logout) endpoint URL (optional)',
        example: 'https://accounts.google.com/logout',
        required: false,
    })
    end_session_endpoint?: string;

    @ApiProperty({
        description: 'Supported response types',
        example: ['code', 'id_token', 'token'],
        type: [String],
    })
    response_types_supported: string[];

    @ApiProperty({
        description: 'Supported scopes (optional)',
        example: ['openid', 'profile', 'email'],
        type: [String],
        required: false,
    })
    scopes_supported?: string[];

    @ApiProperty({
        description: 'Supported grant types (optional)',
        example: ['authorization_code', 'refresh_token'],
        type: [String],
        required: false,
    })
    grant_types_supported?: string[];

    @ApiProperty({
        description: 'Supported token endpoint auth methods (optional)',
        example: ['client_secret_basic', 'client_secret_post'],
        type: [String],
        required: false,
    })
    token_endpoint_auth_methods_supported?: string[];
}

export class OidcTokens {
    @ApiProperty({
        description: 'OAuth2 access token for API calls',
        example: 'ya29.a0AfH6SMBx...',
    })
    access_token: string;

    @ApiProperty({
        description: 'Token type (typically Bearer)',
        example: 'Bearer',
    })
    token_type: string;

    @ApiProperty({
        description: 'Access token expiration in seconds (optional)',
        example: 3599,
        required: false,
    })
    expires_in?: number;

    @ApiProperty({
        description: 'Refresh token for obtaining new access tokens (optional)',
        example: '1//0g...',
        required: false,
    })
    refresh_token?: string;

    @ApiProperty({
        description: 'OpenID Connect ID token (JWT)',
        example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    id_token: string;

    @ApiProperty({
        description: 'Granted scopes (optional)',
        example: 'openid profile email',
        required: false,
    })
    scope?: string;
}

export class OidcStateData {
    @ApiProperty({
        description: 'OAuth2 state parameter for CSRF protection',
        example: 'abc123def456',
    })
    state: string;

    @ApiProperty({
        description: 'OpenID Connect nonce for ID token validation',
        example: 'xyz789uvw012',
    })
    nonce: string;

    @ApiProperty({
        description: 'OIDC configuration ID',
        example: 'config_123456',
    })
    configId: string;

    @ApiProperty({
        description: 'PKCE code verifier (optional)',
        example: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        required: false,
    })
    codeVerifier?: string;
}
