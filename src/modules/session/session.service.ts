import { Injectable, Logger } from '@nestjs/common';
import { AuthResult } from './interfaces/auth-result.interface';

export interface SessionData {
    authResult?: AuthResult;
    state?: string;
    nonce?: string;
    configId?: string;
    codeVerifier?: string;
    createdAt?: string;
}

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    /**
     * Store authentication result in session
     */
    storeAuthResult(session: any, authResult: AuthResult): void {
        this.logger.log('Storing authentication result in session');
        session.authResult = authResult;
    }

    /**
     * Retrieve authentication result from session
     */
    getAuthResult(session: any): AuthResult | null {
        return session?.authResult || null;
    }

    /**
     * Clear authentication result from session
     */
    clearAuthResult(session: any): void {
        this.logger.log('Clearing authentication result from session');
        if (session) {
            delete session.authResult;
        }
    }

    /**
     * Store OIDC state and nonce for validation
     */
    storeOidcState(
        session: any,
        state: string,
        nonce: string,
        configId: string,
        codeVerifier?: string,
    ): void {
        this.logger.log(`Storing OIDC state in session: ${state}`);
        session.state = state;
        session.nonce = nonce;
        session.configId = configId;
        if (codeVerifier) {
            session.codeVerifier = codeVerifier;
        }
        session.createdAt = new Date().toISOString();
    }

    /**
     * Retrieve and validate OIDC state
     */
    validateOidcState(
        session: any,
        state: string,
    ): {
        valid: boolean;
        nonce?: string;
        configId?: string;
        codeVerifier?: string;
    } {
        this.logger.log(`Validating OIDC state: ${state}`);

        if (!session?.state) {
            this.logger.warn('No state found in session');
            return { valid: false };
        }

        if (session.state !== state) {
            this.logger.warn('State mismatch');
            return { valid: false };
        }

        return {
            valid: true,
            nonce: session.nonce,
            configId: session.configId,
            codeVerifier: session.codeVerifier,
        };
    }

    /**
     * Clear OIDC state from session
     */
    clearOidcState(session: any): void {
        this.logger.log('Clearing OIDC state from session');
        if (session) {
            delete session.state;
            delete session.nonce;
            delete session.configId;
            delete session.codeVerifier;
            delete session.createdAt;
        }
    }

    /**
     * Destroy entire session
     */
    async destroySession(session: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!session) {
                resolve();
                return;
            }

            session.destroy((err: Error) => {
                if (err) {
                    this.logger.error('Failed to destroy session', err);
                    reject(err);
                } else {
                    this.logger.log('Session destroyed successfully');
                    resolve();
                }
            });
        });
    }
}
