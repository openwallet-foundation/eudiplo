import { describe, expect, it } from "vitest";
import { MatchedTrustedEntity } from "../../../trust/x509-validation.service";
import { toProvenance } from "./verification-provenance";

describe("toProvenance", () => {
    it("returns undefined when no entity matched", () => {
        expect(toProvenance(null)).toBeUndefined();
    });

    it("prefers the entity id and exposes safe provenance fields", () => {
        const matched = {
            entity: { entityId: "did:example:issuer", services: [] },
            issuanceCert: { subject: "CN=Issuer" },
            issuanceThumbprint: "aabbcc",
            issuanceIsCa: true,
            matchMode: "ca",
            revocationThumbprint: "ddeeff",
        } as unknown as MatchedTrustedEntity;

        expect(toProvenance(matched)).toEqual({
            matchedIssuer: "did:example:issuer",
            issuanceThumbprint: "aabbcc",
            matchMode: "ca",
            revocationThumbprint: "ddeeff",
        });
    });

    it("falls back to the certificate subject when no entity id is present", () => {
        const matched = {
            entity: { services: [] },
            issuanceCert: { subject: "CN=Issuer" },
            issuanceThumbprint: "aabbcc",
            issuanceIsCa: false,
            matchMode: "leaf-pinned",
        } as unknown as MatchedTrustedEntity;

        expect(toProvenance(matched)?.matchedIssuer).toBe("CN=Issuer");
        expect(toProvenance(matched)?.revocationThumbprint).toBeUndefined();
    });
});
