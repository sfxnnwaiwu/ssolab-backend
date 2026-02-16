export interface UserResponse {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AuthResponse {
    user: UserResponse;
    accessToken: string;
    refreshToken?: string;
}

export interface TokenPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}
