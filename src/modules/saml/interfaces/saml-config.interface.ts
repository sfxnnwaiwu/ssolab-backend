export interface SamlConfig {
    idpName: string;
    entityId: string;
    ssoUrl: string;
    certificate: string;
}

export interface SamlConfigResponse {
    url: string;
    configId: string;
    expiresAt: string;
}
