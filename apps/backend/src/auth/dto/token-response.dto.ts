export class TokenResponse {
    access_token!: string;
    refresh_token?: string;
    token_type!: "Bearer";
    expires_in!: number;
    state!: string;
}
