export interface OidcConfig {
    clientId: string;
    clientSecret: string;
    discoveryUrl: string;
    scopes: string[];
    responseType: string[];
}

export interface OidcConfigResponse {
    configId: string;
    expiresAt: string;
}

export interface OidcDiscoveryDocument {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    userinfo_endpoint?: string;
    end_session_endpoint?: string;
    response_types_supported: string[];
    scopes_supported?: string[];
    grant_types_supported?: string[];
    token_endpoint_auth_methods_supported?: string[];
    [key: string]: any;
}

export interface OidcTokens {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    id_token: string;
    scope?: string;
}

export interface OidcStateData {
    state: string;
    nonce: string;
    configId: string;
    codeVerifier?: string;
}
