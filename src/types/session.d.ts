import 'express-session';
import { HttpLogEntry } from '../common/interceptors/logging.interceptor';
import { SamlResult } from '../modules/saml/interfaces/saml-auth-result.interface';

declare module 'express-session' {
    interface SessionData {
        authResult?: SamlResult;
        logs?: HttpLogEntry[];
        samlConfigId?: string;
        samlUserId?: string;
        oidcConfigId?: string;
        oidcUserId?: string;
        state?: string;
        nonce?: string;
        codeVerifier?: string;
    }
}
