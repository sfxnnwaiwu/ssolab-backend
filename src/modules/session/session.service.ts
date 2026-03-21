import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthResult } from './interfaces/auth-result.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

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

    private readonly RESULT_PREFIX = 'auth:result:';
    private readonly RESULT_TTL = 300; // 5 minutes
    private readonly OIDC_LOGOUT_PREFIX = 'oidc:logout:';
    private readonly SAML_LOGOUT_PREFIX = 'saml:logout:';
    private readonly LOGOUT_SESSION_TTL = 1800; // 30 minutes for logout session data

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    // /**
    //  * Store authentication result in session
    //  */
    // storeAuthResult(session: SessionData, authResult: AuthResult): void {
    //     this.logger.log('Storing authentication result in session');
    //     session.authResult = authResult;
    // }

    /**
     * Retrieve authentication result from session
     */
    getAuthResult(session: SessionData): AuthResult | null {
        return session?.authResult || null;
    }

    /**
     * Clear authentication result from session
     */
    clearAuthResult(session: SessionData): void {
        this.logger.log('Clearing authentication result from session');
        if (session) {
            delete session.authResult;
        }
    }

    /**
     * Store OIDC state and nonce for validation
     */
    storeOidcState(
        session: SessionData,
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
        session: SessionData,
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
    clearOidcState(session: SessionData): void {
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

            const sessionWithDestroy = session as {
                destroy?: (callback: (err: Error | null) => void) => void;
            };
            if (typeof sessionWithDestroy.destroy === 'function') {
                sessionWithDestroy.destroy((err: Error | null) => {
                    if (err) {
                        this.logger.error('Failed to destroy session', err);
                        reject(err);
                    } else {
                        this.logger.log('Session destroyed successfully');
                        resolve();
                    }
                });
            } else {
                this.logger.warn('Session destroy method not available');
                resolve();
            }
        });
    }

    /**
     * Store authentication result in cache with a unique ID
     */
    async storeAuthResult(result: any): Promise<string> {
        const resultId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // session.authResult = authResult;

        await this.cacheManager.set(
            `${this.RESULT_PREFIX}${resultId}`,
            JSON.stringify(result),
            this.RESULT_TTL * 1000, // Convert to milliseconds
        );

        return resultId;
    }

    /**
     * Retrieve authentication result by ID
     */
    async getAuthResultById(resultId: string): Promise<any> {
        const cached = await this.cacheManager.get(`${this.RESULT_PREFIX}${resultId}`);

        if (!cached) {
            return null;
        }

        // Optional: Delete after reading (one-time use)
        // await this.cacheManager.del(`${this.RESULT_PREFIX}${resultId}`);

        return JSON.parse(cached as string);
    }

    /**
     * Store OIDC logout session data (id_token, end_session_endpoint, etc.)
     */
    async storeOidcLogoutSession(
        sessionId: string,
        idToken: string,
        endSessionEndpoint: string,
        configId: string,
    ): Promise<void> {
        const logoutData = {
            idToken,
            endSessionEndpoint,
            configId,
            storedAt: new Date().toISOString(),
        };

        const key = `${this.OIDC_LOGOUT_PREFIX}${sessionId}`;
        await this.cacheManager.set(
            key,
            JSON.stringify(logoutData),
            this.LOGOUT_SESSION_TTL * 1000,
        );

        this.logger.log(`Stored OIDC logout session data for session ${sessionId}`);
    }

    /**
     * Retrieve OIDC logout session data
     */
    async getOidcLogoutSession(
        sessionId: string,
    ): Promise<{ idToken: string; endSessionEndpoint: string; configId: string } | null> {
        const key = `${this.OIDC_LOGOUT_PREFIX}${sessionId}`;
        const cached = await this.cacheManager.get<string>(key);

        if (!cached) {
            this.logger.warn(`OIDC logout session data not found for session ${sessionId}`);
            return null;
        }

        return JSON.parse(cached);
    }

    /**
     * Clear OIDC logout session data
     */
    async clearOidcLogoutSession(sessionId: string): Promise<void> {
        const key = `${this.OIDC_LOGOUT_PREFIX}${sessionId}`;
        await this.cacheManager.del(key);
        this.logger.log(`Cleared OIDC logout session data for session ${sessionId}`);
    }

    /**
     * Store SAML logout session data (sessionIndex, nameId, nameIdFormat, sloUrl)
     */
    async storeSamlLogoutSession(
        sessionId: string,
        sessionIndex: string,
        nameId: string,
        nameIdFormat: string,
        sloUrl: string,
        configId: string,
    ): Promise<void> {
        const logoutData = {
            sessionIndex,
            nameId,
            nameIdFormat,
            sloUrl,
            configId,
            storedAt: new Date().toISOString(),
        };

        const key = `${this.SAML_LOGOUT_PREFIX}${sessionId}`;
        await this.cacheManager.set(
            key,
            JSON.stringify(logoutData),
            this.LOGOUT_SESSION_TTL * 1000,
        );

        this.logger.log(`Stored SAML logout session data for session ${sessionId}`);
    }

    /**
     * Retrieve SAML logout session data
     */
    async getSamlLogoutSession(sessionId: string): Promise<{
        sessionIndex: string;
        nameId: string;
        nameIdFormat: string;
        sloUrl: string;
        configId: string;
    } | null> {
        const key = `${this.SAML_LOGOUT_PREFIX}${sessionId}`;
        const cached = await this.cacheManager.get<string>(key);

        if (!cached) {
            this.logger.warn(`SAML logout session data not found for session ${sessionId}`);
            return null;
        }

        return JSON.parse(cached);
    }

    /**
     * Clear SAML logout session data
     */
    async clearSamlLogoutSession(sessionId: string): Promise<void> {
        const key = `${this.SAML_LOGOUT_PREFIX}${sessionId}`;
        await this.cacheManager.del(key);
        this.logger.log(`Cleared SAML logout session data for session ${sessionId}`);
    }
}
