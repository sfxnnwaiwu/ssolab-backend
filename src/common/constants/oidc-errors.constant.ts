import { ErrorDetail } from '../interfaces/error-detail.interface';

export const OIDC_ERROR_DETAILS: Record<string, ErrorDetail> = {
    invalid_client: {
        type: 'invalid_client',
        title: 'OIDC Client Authentication Failed',
        description:
            'The client authentication failed. This typically means the client ID or client secret is incorrect.',
        technicalDetails:
            'The OIDC provider rejected the client credentials during token exchange or userinfo request.',
        troubleshootingSteps: [
            'Verify the client ID matches the one registered with the OIDC provider',
            'Check that the client secret is correct and has not been rotated',
            'Ensure the client is configured for the correct authentication method',
            'Confirm the client credentials are not expired',
            'Review OIDC provider logs for specific authentication errors',
        ],
        relatedDocs: [
            {
                title: 'OAuth 2.0 Client Authentication',
                url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-2.3',
            },
            {
                title: 'OIDC Core Specification',
                url: 'https://openid.net/specs/openid-connect-core-1_0.html',
            },
        ],
    },

    invalid_grant: {
        type: 'invalid_grant',
        title: 'Invalid or Expired Authorization Code',
        description:
            'The authorization code provided is invalid, expired, or has already been used.',
        technicalDetails:
            'The authorization code provided to the token endpoint was rejected by the OIDC provider.',
        troubleshootingSteps: [
            'Ensure the authorization code is being used immediately after receiving it',
            'Check for clock skew between your server and the OIDC provider',
            'Verify the code is not being used more than once (codes are single-use)',
            'Confirm the redirect URI used in token exchange matches the one from the auth request',
            'Check if the code validity period is too short for your application',
            'Review network latency that might cause code expiration',
        ],
        relatedDocs: [
            {
                title: 'OAuth 2.0 Authorization Code Grant',
                url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-4.1',
            },
        ],
    },

    invalid_token: {
        type: 'invalid_token',
        title: 'Invalid Token Signature',
        description:
            'The token signature validation failed. The token may be tampered with or signed with an unexpected key.',
        technicalDetails:
            'JWT signature verification failed when validating the ID token or access token.',
        troubleshootingSteps: [
            'Verify you are using the correct JWKS endpoint from the provider',
            'Check if the provider has rotated their signing keys',
            'Ensure the token has not been modified in transit',
            'Confirm the token algorithm matches what the provider uses',
            'Review provider documentation for key rotation policies',
        ],
        relatedDocs: [
            {
                title: 'JWT Specification',
                url: 'https://datatracker.ietf.org/doc/html/rfc7519',
            },
            {
                title: 'JWS Specification',
                url: 'https://datatracker.ietf.org/doc/html/rfc7515',
            },
        ],
    },

    unauthorized_client: {
        type: 'unauthorized_client',
        title: 'Client Not Authorized',
        description:
            'The client is not authorized to use the requested grant type or response type.',
        technicalDetails:
            'The OIDC provider rejected the request because the client is not configured for this flow.',
        troubleshootingSteps: [
            'Verify the client is registered for the authorization code flow',
            'Check the allowed grant types in the provider client configuration',
            'Ensure the response type matches what the client is configured for',
            'Review provider documentation for supported flows',
            'Confirm the client has the necessary permissions',
        ],
    },

    access_denied: {
        type: 'access_denied',
        title: 'User Denied Authorization',
        description: 'The user or OIDC provider denied the authorization request.',
        technicalDetails:
            'The authorization endpoint returned an access_denied error, typically because the user clicked "Deny" on the consent screen.',
        troubleshootingSteps: [
            'Inform the user they need to approve the authorization request',
            'Check if the requested scopes require admin consent',
            'Verify the user has permission to access the application',
            'Review the consent screen configuration in the provider',
            'Ensure the requested scopes are appropriate for the application',
        ],
    },

    invalid_scope: {
        type: 'invalid_scope',
        title: 'Invalid OAuth Scope',
        description:
            'One or more requested scopes are invalid or not supported by the OIDC provider.',
        technicalDetails: 'The provider does not support one or more of the requested scopes.',
        troubleshootingSteps: [
            'Verify a Check for typos in scope names (scopes are case-sensitive)',
            'Ensure the "openid" scope is included for OIDC flows',
            'Review provider documentation for available scopes',
            'Confirm the client is authorized to request these scopes',
        ],
        relatedDocs: [
            {
                title: 'OIDC Scopes',
                url: 'https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims',
            },
        ],
    },

    invalid_state: {
        type: 'invalid_state',
        title: 'State Parameter Mismatch',
        description: 'The state parameter in the callback does not match the expected value.',
        technicalDetails:
            'State validation failed. This could indicate a CSRF attack or session expiry.',
        troubleshootingSteps: [
            'Ensure the user completes the auth flow in the same browser session',
            'Check if the session has expired during authentication',
            'Verify state is being stored correctly in the session',
            'Review for potential CSRF attacks or malicious callbacks',
            'Confirm the callback URL has not been tampered with',
        ],
        relatedDocs: [
            {
                title: 'OAuth 2.0 State Parameter',
                url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-10.12',
            },
        ],
    },

    invalid_nonce: {
        type: 'invalid_nonce',
        title: 'Nonce Validation Failed',
        description: 'The nonce in the ID token does not match the expected value.',
        technicalDetails:
            'Nonce mismatch detected in ID token claims. This could indicate a token replay attack.',
        troubleshootingSteps: [
            'Ensure the nonce is retrieved from the correct session',
            'Check for session expiry during the authentication flow',
            'Review for potential token replay attacks',
            'Confirm the ID token has not been modified',
        ],
        relatedDocs: [
            {
                title: 'OIDC Nonce',
                url: 'https://openid.net/specs/openid-connect-core-1_0.html#NonceNotes',
            },
        ],
    },

    invalid_issuer: {
        type: 'invalid_issuer',
        title: 'Invalid Token Issuer',
        description: 'The issuer claim in the ID token does not match the expected OIDC provider.',
        technicalDetails:
            'The "iss" claim in the token does not match the issuer from the discovery document.',
        troubleshootingSteps: [
            'Verify the issuer URL in the provider discovery document',
            'Ensure the provider has not changed their issuer identifier',
            'Confirm you are using the correct discovery endpoint',
            'Review provider documentation for the correct issuer value',
        ],
    },

    invalid_audience: {
        type: 'invalid_audience',
        title: 'Invalid Token Audience',
        description: 'The audience claim in the ID token does not include the client ID.',
        technicalDetails: 'The "aud" claim in the token does not contain the expected client ID.',
        troubleshootingSteps: [
            'Verify the client ID matches the one used in the authorization request',
            'Check if the provider is configured with the correct client ID',
            'Ensure the token was issued for your application',
            'Review for potential token replay attacks',
            'Confirm there are no typos in the client ID',
        ],
    },

    token_expired: {
        type: 'token_expired',
        title: 'Token Expired',
        description: 'The ID token or access token has expired.',
        technicalDetails: 'The "exp" claim indicates the token is no longer valid.',
        troubleshootingSteps: [
            'Implement token refresh if supported by the provider',
            'Check for clock skew between your server and the provider',
            'Verify your server time is synchronized using NTP',
            'Review the token validity period (may be too short)',
            'Ensure tokens are being validated promptly after receipt',
        ],
    },
    discovery_failed: {
        type: 'discovery_failed',
        title: 'OIDC Discovery Failed',
        description: 'Failed to retrieve or parse the OIDC discovery document from the provider.',
        technicalDetails: 'Could not fetch or parse the .well-known/openid-configuration endpoint.',
        troubleshootingSteps: [
            'Verify the issuer URL is correct and accessible',
            'Check network connectivity to the OIDC provider',
            'Ensure the provider supports OIDC discovery',
            'Review firewall rules that might block outbound requests',
            'Confirm the discovery endpoint returns valid JSON',
            'Check provider status page for outages',
        ],
        relatedDocs: [
            {
                title: 'OIDC Discovery',
                url: 'https://openid.net/specs/openid-connect-discovery-1_0.html',
            },
        ],
    },

    config_not_found: {
        type: 'config_not_found',
        title: 'OIDC Configuration Not Found',
        description: 'No OIDC configuration found for the provided configuration ID.',
        technicalDetails:
            'Configuration lookup in Redis failed or returned null for the provided config ID.',
        troubleshootingSteps: [
            'Verify the configuration was submitted successfully before initiating login',
            'Check if the configuration has expired (default TTL: 1 hour)',
            'Ensure you are using the correct configuration ID from the submit response',
            'Confirm Redis is running and accessible',
            'Re-submit the OIDC configuration if it has expired',
        ],
    },
    callback_error: {
        type: 'callback_error',
        title: 'OIDC Callback Error',
        description: 'The OIDC provider returned an error during the callback.',
        technicalDetails: 'The callback URL contained an error parameter from the provider.',
        troubleshootingSteps: [
            'Review the error description returned by the provider',
            'Check provider logs for more details about the error',
            'Verify all configuration parameters are correct',
            'Ensure the redirect URI is properly registered',
            'Review provider documentation for specific error codes',
        ],
    },

    pkce_failed: {
        type: 'pkce_failed',
        title: 'PKCE Validation Failed',
        description:
            'The code verifier does not match the code challenge sent in the authorization request.',
        technicalDetails:
            'The code verifier does not match the code challenge sent in the authorization request.',
        troubleshootingSteps: [
            'Ensure the code verifier is stored correctly in the session',
            'Verify the code challenge method matches what the provider expects',
            'Check that the verifier is being sent correctly in the token request',
            'Confirm the session has not expired between authorization and token exchange',
            'Review PKCE implementation for proper SHA-256 hashing',
        ],
        relatedDocs: [
            {
                title: 'PKCE Specification',
                url: 'https://datatracker.ietf.org/doc/html/rfc7636',
            },
        ],
    },
};
