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
    @IsOptional()
    @IsString()
    providerName?: string;

    @IsNotEmpty()
    @IsString()
    clientId: string;

    @IsNotEmpty()
    @IsString()
    clientSecret: string;

    @IsNotEmpty()
    @IsUrl()
    @Matches(/^https:\/\//, { message: 'Discovery URL must use HTTPS protocol' })
    @Matches(/\.well-known\/openid-configuration$/, {
        message: 'Discovery URL must end with /.well-known/openid-configuration',
    })
    discoveryUrl: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Scopes array must contain at least one scope' })
    @ContainsOpenIdScope()
    scopes: string[];

    @IsArray()
    @ArrayMinSize(1, { message: 'Response type array must contain at least one type' })
    @IsIn(['code', 'id_token', 'token'], {
        each: true,
        message: 'Response type must be one of: code, id_token, token',
    })
    responseType: string[];
}
