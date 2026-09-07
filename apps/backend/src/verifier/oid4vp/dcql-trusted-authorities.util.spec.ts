import { describe, expect, test } from "vitest";
import { applyTrustedAuthoritiesPolicy } from "./dcql-trusted-authorities.util.js";

describe("applyTrustedAuthoritiesPolicy", () => {
    const dcqlQuery = {
        credentials: [
            {
                id: "cred1",
                format: "dc+sd-jwt",
                trusted_authorities: [{ type: "aki", values: ["abc"] }],
            },
            {
                id: "cred2",
                format: "mso_mdoc",
                trusted_authorities: [{ type: "aki", values: ["def"] }],
            },
        ],
    };

    test("keeps trusted_authorities when removeTrustedAuthorities is false", () => {
        const result = applyTrustedAuthoritiesPolicy(dcqlQuery, false);

        expect(result.credentials[0].trusted_authorities).toEqual([
            { type: "aki", values: ["abc"] },
        ]);
        expect(result.credentials[1].trusted_authorities).toEqual([
            { type: "aki", values: ["def"] },
        ]);
    });

    test("returns the same query reference when removeTrustedAuthorities is false", () => {
        const result = applyTrustedAuthoritiesPolicy(dcqlQuery, false);

        expect(result).toBe(dcqlQuery);
    });

    test("strips trusted_authorities from every credential when removeTrustedAuthorities is true", () => {
        const result = applyTrustedAuthoritiesPolicy(dcqlQuery, true);

        expect(
            result.credentials.some((cred) => "trusted_authorities" in cred),
        ).toBe(false);
    });

    test("preserves all other credential fields when stripping", () => {
        const result = applyTrustedAuthoritiesPolicy(dcqlQuery, true);

        expect(result.credentials[0]).toEqual({
            id: "cred1",
            format: "dc+sd-jwt",
        });
        expect(result.credentials[1]).toEqual({
            id: "cred2",
            format: "mso_mdoc",
        });
    });

    test("does not mutate the original dcqlQuery when stripping", () => {
        applyTrustedAuthoritiesPolicy(dcqlQuery, true);

        expect(dcqlQuery.credentials[0].trusted_authorities).toEqual([
            { type: "aki", values: ["abc"] },
        ]);
    });

    test("handles credentials that never had trusted_authorities", () => {
        const query = { credentials: [{ id: "cred1", format: "dc+sd-jwt" }] };

        const result = applyTrustedAuthoritiesPolicy(query, true);

        expect(result.credentials[0]).toEqual({
            id: "cred1",
            format: "dc+sd-jwt",
        });
    });
});
