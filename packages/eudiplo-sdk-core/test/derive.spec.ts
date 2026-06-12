import { describe, expect, it } from "vitest";
import {
  buildClaims,
  buildClaimsByNamespace,
  buildClaimsMetadata,
  buildDisclosureFrame,
  buildJsonSchema,
} from "../src/config";
import type { ClaimFieldDefinition } from "../src/config";

describe("config derive helpers", () => {
  it("builds SD-JWT runtime artifacts from fields", () => {
    const fields: ClaimFieldDefinition[] = [
      {
        path: ["given_name"],
        type: "string",
        defaultValue: "Erika",
        disclosable: true,
        display: [{ lang: "en-US", label: "Given Name" }],
      },
      {
        path: ["address", "locality"],
        type: "string",
        defaultValue: "Berlin",
        disclosable: true,
        mandatory: true,
        display: [{ lang: "en-US", label: "City" }],
      },
    ];

    expect(buildClaims(fields)).toEqual({
      given_name: "Erika",
      address: {
        locality: "Berlin",
      },
    });

    expect(buildDisclosureFrame(fields)).toEqual({
      _sd: ["given_name"],
      address: {
        _sd: ["locality"],
      },
    });

    expect(buildClaimsMetadata(fields)).toEqual([
      {
        path: ["given_name"],
        display: [{ name: "Given Name", locale: "en-US" }],
      },
      {
        path: ["address", "locality"],
        mandatory: true,
        display: [{ name: "City", locale: "en-US" }],
      },
    ]);

    expect(buildJsonSchema(fields)).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        given_name: {
          type: "string",
          title: "Given Name",
        },
        address: {
          type: "object",
          properties: {
            locality: {
              type: "string",
              title: "City",
            },
          },
          required: ["locality"],
        },
      },
    });
  });

  it("builds mDOC claims by namespace", () => {
    const fields: ClaimFieldDefinition[] = [
      {
        path: ["given_name"],
        namespace: "eu.europa.ec.eudi.pid.1",
        type: "string",
        defaultValue: "Erika",
      },
      {
        path: ["birth_date"],
        namespace: "eu.europa.ec.eudi.pid.1",
        type: "string",
        defaultValue: "1964-08-12",
      },
    ];

    expect(buildClaimsByNamespace(fields)).toEqual({
      "eu.europa.ec.eudi.pid.1": {
        given_name: "Erika",
        birth_date: "1964-08-12",
      },
    });
  });

  it("handles empty fields", () => {
    expect(buildClaims([])).toEqual({});
    expect(buildClaimsMetadata([])).toEqual([]);
    expect(buildClaimsByNamespace([])).toEqual({});
    expect(buildDisclosureFrame([])).toBeUndefined();
    expect(buildJsonSchema([])).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {},
    });
  });
});
