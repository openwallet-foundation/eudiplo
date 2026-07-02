export class ParResponseDto {
    /**
     * The request URI for the Pushed Authorization Request.
     */
    request_uri!: string;
    /**
     * The expiration time for the request URI in seconds.
     */
    expires_in!: number;
}
