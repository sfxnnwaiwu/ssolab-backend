import { IsNotEmpty, IsString, IsUrl, Length, Matches } from 'class-validator';
import { ValidateCertificate } from '../../../common/validators/certificate.validator';

export class SamlConfigDto {
    @IsNotEmpty({ message: 'IdP name is required' })
    @IsString({ message: 'IdP name must be a string' })
    @Length(1, 100, { message: 'IdP name must be between 1 and 100 characters' })
    idpName: string;

    @IsNotEmpty({ message: 'Entity ID is required' })
    @IsUrl({}, { message: 'Entity ID must be a valid URL' })
    entityId: string;

    @IsNotEmpty({ message: 'SSO URL is required' })
    @IsUrl({}, { message: 'SSO URL must be a valid URL' })
    @Matches(/^https:\/\//, { message: 'SSO URL must use HTTPS protocol' })
    ssoUrl: string;

    @IsNotEmpty({ message: 'Certificate is required' })
    @IsString({ message: 'Certificate must be a string' })
    @ValidateCertificate()
    certificate: string;
}
