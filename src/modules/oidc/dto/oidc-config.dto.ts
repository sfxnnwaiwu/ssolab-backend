import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMinSize,
    IsArray,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
} from 'class-validator';
import { ContainsOpenIdScope } from '../../../common/validators/scopes.validator';

export class OidcConfigDto {
    @ApiProperty({
        description: 'Display name for the OIDC provider',
        example: 'Google',
        required: false,
    })
    @IsOptional()
    @IsString()
    providerName?: string;

    @ApiProperty({
        description: 'OIDC Client ID from your identity provider',
        example: '123456789.apps.googleusercontent.com',
    })
    @IsNotEmpty()
    @IsString()
    clientId: string;

    @ApiProperty({
        description: 'OIDC Client Secret from your identity provider',
        example: 'GOCSPX-aBcDeFgHiJkLmNoPqRsT',
    })
    @IsNotEmpty()
    @IsString()
    clientSecret: string;

    @ApiProperty({
        description:
            'OpenID Provider Configuration URL (must be HTTPS and end with /.well-known/openid-configuration)',
        example: 'https://accounts.google.com/.well-known/openid-configuration',
    })
    @IsNotEmpty()
    @IsUrl()
    @Matches(/^https:\/\//, { message: 'Discovery URL must use HTTPS protocol' })
    @Matches(/\.well-known\/openid-configuration$/, {
        message: 'Discovery URL must end with /.well-known/openid-configuration',
    })
    discoveryUrl: string;

    @ApiProperty({
        description: 'List of OIDC scopes (must include at least one, typically openid)',
        example: ['openid', 'profile', 'email'],
        type: [String],
        minItems: 1,
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'Scopes array must contain at least one scope' })
    @ContainsOpenIdScope()
    scopes: string[];

    @ApiProperty({
        description: 'OIDC response type(s) requested from the provider',
        example: ['code'],
        type: [String],
        enum: ['code', 'id_token', 'token'],
        minItems: 1,
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'Response type array must contain at least one type' })
    @IsIn(['code', 'id_token', 'token'], {
        each: true,
        message: 'Response type must be one of: code, id_token, token',
    })
    responseType: string[];
}
