import { ApiProperty } from '@nestjs/swagger';
import { ErrorDetail } from '../../../common/interfaces/error-detail.interface';
import { RequestLog, ResponseLog } from '../../../common/interfaces/log.interface';

export class SamlResponseConditions {
    @ApiProperty({
        description: 'SAML response valid before timestamp',
        example: '2026-03-21T10:00:00.000Z',
    })
    notBefore: string;

    @ApiProperty({
        description: 'SAML response valid after timestamp',
        example: '2026-03-21T11:00:00.000Z',
    })
    notOnOrAfter: string;

    @ApiProperty({
        description: 'Intended audience for the SAML response',
        example: 'https://example.com/saml/metadata',
    })
    audience: string;
}

export class SamlResponseDecoded {
    @ApiProperty({
        description: 'SAML Identity Provider issuer',
        example: 'https://example.okta.com',
    })
    issuer: string;

    @ApiProperty({
        description: 'Authenticated subject/user identifier',
        example: 'user@example.com',
    })
    subject: string;

    @ApiProperty({
        description: 'SAML session index',
        example: '_8e8dc5f69a98cc4c1ff3427e5ce34606fd672f91e8',
    })
    sessionIndex: string;

    @ApiProperty({
        description: 'SAML response validity conditions',
        type: SamlResponseConditions,
    })
    conditions: SamlResponseConditions;
}

export class SamlResponseEnvelope {
    @ApiProperty({
        description: 'Decoded SAML response data',
        type: SamlResponseDecoded,
    })
    decoded: SamlResponseDecoded;

    @ApiProperty({
        description: 'Raw SAML response XML (base64 encoded)',
        example:
            'PFJlc3BvbnNlIHhtbG5zPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPi4uLjwvUmVzcG9uc2U+',
    })
    raw: string;
}

export class SamlAuthResult {
    @ApiProperty({
        description: 'Authentication success indicator',
        example: true,
    })
    success: true;

    @ApiProperty({
        description: 'Authentication protocol used',
        example: 'saml',
    })
    protocol: 'saml';

    @ApiProperty({
        description: 'Timestamp of authentication',
        example: '2026-03-21T10:30:00.000Z',
    })
    timestamp: string;

    @ApiProperty({
        description: 'SAML response envelope and decoded data',
        type: SamlResponseEnvelope,
    })
    samlResponse: SamlResponseEnvelope;

    @ApiProperty({
        description: 'User attributes extracted from SAML response',
        example: {
            email: 'user@example.com',
            name: 'John Doe',
            groups: ['admin', 'developers'],
        },
        additionalProperties: { type: 'object' },
    })
    userAttributes: Record<string, string | string[]>;

    @ApiProperty({
        description: 'HTTP request log details',
        type: Object,
    })
    requestLog: RequestLog;

    @ApiProperty({
        description: 'HTTP response log details',
        type: Object,
    })
    responseLog: ResponseLog;
}

export class SamlErrorResult {
    @ApiProperty({
        description: 'Authentication failure indicator',
        example: false,
    })
    success: false;

    @ApiProperty({
        description: 'Authentication protocol used',
        example: 'saml',
    })
    protocol: 'saml';

    @ApiProperty({
        description: 'Error details including type, title, and troubleshooting steps',
        type: Object,
    })
    error: ErrorDetail;

    @ApiProperty({
        description: 'HTTP request log details',
        type: Object,
    })
    requestLog: RequestLog;

    @ApiProperty({
        description: 'HTTP response log details',
        type: Object,
    })
    responseLog: ResponseLog;
}

export type SamlResult = SamlAuthResult | SamlErrorResult;
