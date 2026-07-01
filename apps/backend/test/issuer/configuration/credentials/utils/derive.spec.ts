import { describe, expect, it } from "vitest";
import { buildClaimsByNamespace } from "../../../../../src/issuer/configuration/credentials/utils/derive";

describe("buildClaimsByNamespace", () => {
    it("infers the namespace from the first path segment when namespace is omitted", () => {
        const claimsByNamespace = buildClaimsByNamespace([
            {
                path: ["eu.europa.ec.eudi.pid.1", "given_name"],
                type: "string",
                defaultValue: "ERIKA",
            },
            {
                path: ["eu.europa.ec.eudi.pid.1", "age_over_18"],
                type: "boolean",
                defaultValue: true,
            },
        ] as any);

        expect(claimsByNamespace).toEqual({
            "eu.europa.ec.eudi.pid.1": {
                given_name: "ERIKA",
                age_over_18: true,
            },
        });
    });

    it("still uses an explicit namespace when provided", () => {
        const claimsByNamespace = buildClaimsByNamespace([
            {
                path: ["given_name"],
                type: "string",
                defaultValue: "ERIKA",
                namespace: "eu.europa.ec.eudi.pid.1",
            },
        ] as any);

        expect(claimsByNamespace).toEqual({
            "eu.europa.ec.eudi.pid.1": {
                given_name: "ERIKA",
            },
        });
    });
});
