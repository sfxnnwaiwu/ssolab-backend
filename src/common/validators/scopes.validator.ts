import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'containsOpenIdScope', async: false })
export class ContainsOpenIdScopeConstraint implements ValidatorConstraintInterface {
    validate(scopes: string[]): boolean {
        if (!Array.isArray(scopes)) {
            return false;
        }
        return scopes.includes('openid');
    }

    defaultMessage(): string {
        return 'Scopes array must contain "openid" scope';
    }
}

export function ContainsOpenIdScope(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: ContainsOpenIdScopeConstraint,
        });
    };
}
