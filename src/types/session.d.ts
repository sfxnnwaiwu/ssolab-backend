import 'express-session';
import { SamlResult } from '../modules/saml/interfaces/saml-auth-result.interface';

declare module 'express-session' {
    interface SessionData {
        authResult?: SamlResult;
    }
}
