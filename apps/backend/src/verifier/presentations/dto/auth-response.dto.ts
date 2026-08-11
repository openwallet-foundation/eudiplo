import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const AuthResponseSchema = z
    .object({
        vp_token: z.record(z.string(), z.array(z.string())),
        state: z.string().optional(),
        iat: z.number().optional(),
        exp: z.number().optional(),
    })
    .strict();

/**
 * AuthResponse DTO
 */
export class AuthResponse extends createZodDto(AuthResponseSchema) {
    /**
     * The VP token containing the presentation data.
     */
    vp_token!: {
        /**
         * Key-value pairs representing the VP token data.
         */
        [key: string]: string[];
    };
    /**
     * The state parameter to maintain state between the request and callback.
     */
    state?: string;

    /**
     * The issued at timestamp (optional).
     */
    iat?: number;

    /**
     * The expiration timestamp (optional).
     */
    exp?: number;
}
