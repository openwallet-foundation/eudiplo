import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import { buildJsonSchema } from "./derive";
import type { ClaimFieldDefinition } from "./types";

describe("buildJsonSchema", () => {
    it("produces AJV-valid schemas for array claims like nationalities", () => {
        const fields: ClaimFieldDefinition[] = [
            {
                path: ["nationalities", 0],
                type: "string",
                defaultValue: "DE",
            },
            {
                path: ["nationalities"],
                type: "array",
                defaultValue: ["DE"],
                constraints: {
                    items: {
                        type: "string",
                        title: "Nationality",
                    },
                },
            },
        ];

        const schema = buildJsonSchema(fields);
        const ajv = new Ajv({
            allErrors: true,
            strict: true,
            useDefaults: true,
            validateSchema: false,
        });
        const validate = ajv.compile(schema as any);

        expect(validate({ nationalities: ["DE"] })).toBe(true);
        expect(() => ajv.compile(schema as any)).not.toThrow();
    });

    it("keeps object claim branches typed as objects when they hold nested properties", () => {
        const fields: ClaimFieldDefinition[] = [
            {
                path: ["place_of_birth", "locality"],
                type: "string",
                defaultValue: "BERLIN",
                mandatory: true,
            },
            {
                path: ["place_of_birth"],
                type: "object",
                defaultValue: { locality: "BERLIN" },
                mandatory: true,
            },
        ];

        const schema = buildJsonSchema(fields);
        expect(schema.properties?.place_of_birth).toMatchObject({
            type: "object",
            properties: { locality: { type: "string" } },
        });
    });
});
