import { ErrorDetail } from '../interfaces/error-detail.interface';

export const SAML_ERROR_DETAILS: Record<string, ErrorDetail> = {
    invalid_signature: {
        type: 'invalid_signature',
        title: 'SAML Signature Validation Failed',
        description:
            'The digital signature on the SAML response could not be verified against the configured certificate.',
        technicalDetails:
            'Certificate validation failed. The signature in the SAML response does not match the expected signature from the configured IdP certificate.',
        troubleshootingSteps: [
            'Verify the IdP certificate in your configuration matches the one used by the IdP',
            'Check if the IdP certificate has expired or been rotated',
            'Ensure the certificate is in valid PEM format with proper headers/footers',
            'Confirm the SAML response has not been modified in transit',
            'Check for clock skew between SP and IdP servers',
        ],
        relatedDocs: [
            {
                title: 'SAML 2.0 Specification',
                url: 'https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf',
            },
            {
                title: 'XML Signature Syntax and Processing',
                url: 'https://www.w3.org/TR/xmldsig-core/',
            },
        ],
    },

    expired_assertion: {
        type: 'expired_assertion',
        title: 'SAML Assertion Expired',
        description:
            'The SAML assertion has expired based on the NotBefore/NotOnOrAfter conditions.',
        technicalDetails:
            'The current server time falls outside the valid time window specified in the SAML assertion conditions.',
        troubleshootingSteps: [
            'Check for clock skew between your server and the IdP',
            'Verify your server time is synchronized using NTP',
            'Review the IdP assertion validity period configuration',
            'Check if the assertion lifetime is too short for your network latency',
            'Ensure the user completed authentication before the assertion expired',
        ],
        relatedDocs: [
            {
                title: 'SAML 2.0 Conditions',
                url: 'https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf#page=17',
            },
        ],
    },

    invalid_audience: {
        type: 'invalid_audience',
        title: 'SAML Audience Restriction Failed',
        description:
            'The audience restriction in the SAML assertion does not match the configured entity ID.',
        technicalDetails:
            'The assertion audience does not include the expected SP entity ID. This prevents replay attacks.',
        troubleshootingSteps: [
            'Verify your SP entity ID matches what the IdP expects',
            'Check the IdP configuration for the correct audience value',
            'Ensure the entity ID is consistent across all SAML configuration',
            'Review IdP metadata for the expected audience restriction',
            'Confirm there are no extra spaces or URL encoding issues in the entity ID',
        ],
        relatedDocs: [
            {
                title: 'SAML 2.0 Audience Restriction',
                url: 'https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf#page=18',
            },
        ],
    },

    missing_attributes: {
        type: 'missing_attributes',
        title: 'Required SAML Attributes Missing',
        description: 'One or more required attributes are missing from the SAML assertion.',
        technicalDetails:
            'The SAML assertion did not contain all attributes required by your application (e.g., email, firstName, lastName).',
        troubleshootingSteps: [
            'Review the list of required attributes in your application configuration',
            'Verify the IdP is configured to send all required attributes',
            'Check the attribute mapping in the IdP configuration',
            'Ensure the user account has values for all required attributes',
            'Review IdP logs to confirm attributes are being sent',
            'Verify attribute name format matches (case-sensitive)',
        ],
    },

    certificate_mismatch: {
        type: 'certificate_mismatch',
        title: 'SAML Certificate Mismatch',
        description:
            'The certificate in the SAML response does not match the configured certificate.',
        technicalDetails:
            'The X.509 certificate included in the SAML response differs from the certificate configured for this IdP.',
        troubleshootingSteps: [
            'Verify you have the latest certificate from the IdP',
            'Check if the IdP has rotated their signing certificate',
            'Ensure you copied the entire certificate including headers/footers',
            'Confirm the certificate format is correct (PEM)',
            'Review IdP metadata for the current signing certificate',
        ],
    },

    invalid_response_format: {
        type: 'invalid_response_format',
        title: 'Invalid SAML Response Format',
        description:
            'The SAML response is malformed or does not conform to the SAML 2.0 specification.',
        technicalDetails: 'XML parsing failed or the SAML response structure is invalid.',
        troubleshootingSteps: [
            'Check if the SAMLResponse parameter is properly Base64 encoded',
            'Verify the IdP is sending SAML 2.0 compliant responses',
            'Review the raw SAML response for XML syntax errors',
            'Ensure the response includes all required SAML elements',
            'Check for character encoding issues in the response',
        ],
    },

    invalid_destination: {
        type: 'invalid_destination',
        title: 'Invalid SAML Destination',
        description: 'The destination URL in the SAML response does not match the ACS URL.',
        technicalDetails:
            'The Destination attribute in the SAML response must exactly match the Assertion Consumer Service URL.',
        troubleshootingSteps: [
            'Verify your ACS URL configuration matches what the IdP expects',
            'Ensure the ACS URL includes the correct protocol (http/https)',
            'Check that the ACS URL matches exactly (including trailing slashes)',
            'Review IdP configuration for the correct ACS URL',
            'Confirm the URL is not URL-encoded or contains extra parameters',
        ],
        relatedDocs: [
            {
                title: 'SAML 2.0 Destination',
                url: 'https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf#page=38',
            },
        ],
    },

    config_not_found: {
        type: 'config_not_found',
        title: 'SAML Configuration Not Found',
        description: 'No SAML configuration found for the provided configuration ID.',
        technicalDetails:
            'Configuration lookup in Redis failed or returned null for the provided config ID.',
        troubleshootingSteps: [
            'Verify the configuration was submitted successfully before initiating login',
            'Check if the configuration has expired (default TTL: 1 hour)',
            'Ensure you are using the correct configuration ID from the submit response',
            'Confirm Redis is running and accessible',
            'Re-submit the SAML configuration if it has expired',
        ],
    },

    saml_response_missing: {
        type: 'saml_response_missing',
        title: 'SAML Response Missing',
        description: 'The SAML callback endpoint was called without a SAMLResponse parameter.',
        technicalDetails:
            'The POST request to the ACS endpoint did not contain a SAMLResponse parameter.',
        troubleshootingSteps: [
            'Verify the IdP callback URL is correctly configured to your ACS endpoint',
            'Check if the IdP is using HTTP-POST binding (not HTTP-Redirect)',
            'Ensure the IdP is configured to send the SAML response as a POST parameter',
            'Review IdP logs to confirm the response was sent',
            'Check for browser errors that may have prevented form submission',
        ],
    },
};
