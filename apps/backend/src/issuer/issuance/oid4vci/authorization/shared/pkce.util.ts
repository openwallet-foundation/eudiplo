import { createHash } from "node:crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";

export function verifyPkceCodeChallenge(
    codeChallenge?: string,
    codeChallengeMethod?: string,
    codeVerifier?: string,
): void {
    if (codeChallenge && codeVerifier) {
        const expectedChallenge =
            codeChallengeMethod === "S256"
                ? createHash("sha256").update(codeVerifier).digest("base64url")
                : codeVerifier;
        if (expectedChallenge !== codeChallenge) {
            throw new UnauthorizedException("Invalid code_verifier");
        }
        return;
    }

    if (codeChallenge && !codeVerifier) {
        throw new BadRequestException("code_verifier is required");
    }
}