import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isCertificate', async: false })
export class IsCertificateConstraint implements ValidatorConstraintInterface {
    validate(certificate: string): boolean {
        if (!certificate || typeof certificate !== 'string') {
            return false;
        }

        // Check if certificate contains BEGIN and END markers
        const hasBeginMarker = certificate.includes('-----BEGIN CERTIFICATE-----');
        const hasEndMarker = certificate.includes('-----END CERTIFICATE-----');

        if (!hasBeginMarker || !hasEndMarker) {
            return false;
        }

        // Check if BEGIN comes before END
        const beginIndex = certificate.indexOf('-----BEGIN CERTIFICATE-----');
        const endIndex = certificate.indexOf('-----END CERTIFICATE-----');

        if (beginIndex >= endIndex) {
            return false;
        }

        // Extract the certificate content between markers
        const certContent = certificate
            .substring(beginIndex + '-----BEGIN CERTIFICATE-----'.length, endIndex)
            .replace(/\s/g, '');

        // Check if there's actual content
        if (certContent.length === 0) {
            return false;
        }

        // Basic Base64 validation
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        return base64Regex.test(certContent);
    }

    defaultMessage(): string {
        return 'Certificate must be in valid PEM format with BEGIN CERTIFICATE and END CERTIFICATE markers';
    }
}

export function ValidateCertificate(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsCertificateConstraint,
        });
    };
}
