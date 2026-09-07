import { describe, expect, it } from "vitest";
import { SdJwtVerificationError } from "./sdjwtvcverifier.service.js";

describe("SdJwtVerificationError", () => {
    it("exposes the failure type and a structured, safe response body", () => {
        const err = new SdJwtVerificationError(
            "trust_chain_not_trusted",
            "verbose: leaf subject=CN=Acme, thumbprint=deadbeef, list=https://x/y",
        );

        expect(err.failureType).toBe("trust_chain_not_trusted");
        // Verbose reason is retained for logs/audit, not exposed in the body.
        expect(err.verboseReason).toContain("thumbprint");

        const body = err.getResponse() as { error: string; message: string };
        expect(body.error).toBe("trust_chain_not_trusted");
        expect(body.message).toBe(
            "The credential issuer is not in the trusted list.",
        );
        // The safe message must not leak verbose diagnostics.
        expect(body.message).not.toMatch(/subject=|thumbprint|https?:\/\//i);
    });

    it("defaults to the generic message for a generic failure type", () => {
        const body = new SdJwtVerificationError(
            "verification_error",
        ).getResponse() as { error: string; message: string };
        expect(body.error).toBe("verification_error");
        expect(body.message).toBe("The credential could not be verified.");
    });
});
