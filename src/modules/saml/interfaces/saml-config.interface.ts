export interface SamlConfig {
    idpName: string;
    entityId: string;
    ssoUrl: string;
    certificate: string;
}

export interface SamlConfigResponse {
    configId: string;
    expiresAt: string;
}
