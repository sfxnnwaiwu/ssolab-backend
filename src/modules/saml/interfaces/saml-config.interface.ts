import { ApiProperty } from '@nestjs/swagger';

export class SamlConfig {
    @ApiProperty({
        description: 'SAML Identity Provider display name',
        example: 'Okta',
    })
    idpName: string;

    @ApiProperty({
        description: 'Service Provider Entity ID',
        example: 'https://example.com/saml/metadata',
    })
    entityId: string;

    @ApiProperty({
        description: 'SAML Single Sign-On Service URL',
        example: 'https://example.okta.com/app/general/saml2/sso',
    })
    ssoUrl: string;

    @ApiProperty({
        description: 'Identity Provider X.509 certificate',
        example: `-----BEGIN CERTIFICATE-----
MIICXgIBAAKBgQDMM7fXfXgQC6p5XTgzqb...
-----END CERTIFICATE-----`,
    })
    certificate: string;
}

export class SamlConfigResponse {
    @ApiProperty({
        description: 'SAML authentication request URL to redirect user to IdP',
        example: 'https://example.okta.com/app/general/saml2/sso?SAMLRequest=fZJNa8IwGIb...',
    })
    url: string;

    @ApiProperty({
        description: 'Configuration ID for this SAML setup',
        example: 'config_789012',
    })
    configId: string;

    @ApiProperty({
        description: 'Configuration expiration timestamp',
        example: '2026-03-21T15:00:00.000Z',
    })
    expiresAt: string;
}
