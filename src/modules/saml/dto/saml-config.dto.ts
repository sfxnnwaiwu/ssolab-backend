import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { ValidateCertificate } from '../../../common/validators/certificate.validator';

export class SamlConfigDto {
    @ApiProperty({
        description: 'Display name for the SAML Identity Provider',
        example: 'Okta',
        minLength: 1,
        maxLength: 100,
    })
    @IsNotEmpty({ message: 'IdP name is required' })
    @IsString({ message: 'IdP name must be a string' })
    @Length(1, 100, { message: 'IdP name must be between 1 and 100 characters' })
    idpName: string;

    @ApiProperty({
        description: 'SAML Service Provider Entity ID (typically your app URL)',
        example: 'https://example.com/saml/metadata',
    })
    @IsNotEmpty({ message: 'Entity ID is required' })
    @IsUrl({}, { message: 'Entity ID must be a valid URL' })
    entityId: string;

    @ApiProperty({
        description: 'SAML Single Sign-On Service URL (must use HTTPS)',
        example: 'https://example.okta.com/app/general/saml2/sso',
    })
    @IsNotEmpty({ message: 'SSO URL is required' })
    @IsUrl({}, { message: 'SSO URL must be a valid URL' })
    @Matches(/^https:\/\//, { message: 'SSO URL must use HTTPS protocol' })
    ssoUrl: string;

    @ApiProperty({
        description: 'SAML Single Logout Service URL (optional, must use HTTPS)',
        example: 'https://example.okta.com/app/general/saml2/slo',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'SLO URL must be a valid URL' })
    @Matches(/^https:\/\//, { message: 'SLO URL must use HTTPS protocol' })
    sloUrl?: string;

    @ApiProperty({
        description:
            'SAML Identity Provider X.509 certificate (PEM format, BEGIN CERTIFICATE to END CERTIFICATE)',
        example: `-----BEGIN CERTIFICATE-----
                MIICXgIBAAKBgQDMM7fXfXgQC6p5XTgzqb...
                -----END CERTIFICATE-----`,
    })
    @IsNotEmpty({ message: 'Certificate is required' })
    @IsString({ message: 'Certificate must be a string' })
    @ValidateCertificate()
    certificate: string;
}
