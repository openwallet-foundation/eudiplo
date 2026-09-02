import { describe, expect, it } from "vitest";
import { PresentationConfigCreateSchema } from "./presentation-config.schema";

const basePresentationConfig = {
    id: "age-over-16",
    description: "Age over 16",
    dcql_query: {
        credentials: [
            {
                id: "age_credential",
                format: "dc+sd-jwt",
                meta: {
                    vct_values: ["https://example.com/age"],
                },
            },
        ],
    },
};

describe("PresentationConfigCreateSchema", () => {
    it("accepts registration certificate fields submitted by the management UI", () => {
        const result = PresentationConfigCreateSchema.safeParse({
            ...basePresentationConfig,
            registrationCertImportJwt: "",
            registrationCertImportId: "cert-1",
            registrationCertBodyPrivacyPolicy: "https://example.com/privacy",
            registrationCertBodySupportUri: "https://example.com/support",
            registrationCertBodyIntermediary: "Example Verifier",
            registrationCertBodyPurpose: [
                {
                    lang: "en-US",
                    content: "Verify age eligibility",
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("continues rejecting unrelated fields", () => {
        const result = PresentationConfigCreateSchema.safeParse({
            ...basePresentationConfig,
            unknownField: true,
        });

        expect(result.success).toBe(false);
    });
});
