import { createHash } from "node:crypto";
import { decodeProtectedHeader } from "jose";

/**
 * Extract DPoP JWK thumbprint from DPoP JWT.
 * Returns undefined if parsing fails or DPoP is not provided.
 */
export function extractDpopJkt(dpopJwt?: string): string | undefined {
    if (!dpopJwt) {
        return undefined;
    }
    try {
        const header = decodeProtectedHeader(dpopJwt);
        if (header.jwk) {
            // Calculate JWK thumbprint (simplified - in production use jose's calculateJwkThumbprint)
            const thumbprintInput = JSON.stringify({
                crv: header.jwk.crv,
                kty: header.jwk.kty,
                x: header.jwk.x,
                y: header.jwk.y,
            });
            return createHash("sha256")
                .update(thumbprintInput)
                .digest("base64url");
        }
    } catch {
        // Invalid DPoP JWT
    }
    return undefined;
}
