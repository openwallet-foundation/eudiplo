import { test } from "@fast-check/vitest";
import * as fc from "fast-check";
import { describe, expect } from "vitest";
import {
  CONFIG_RESOURCE_KINDS,
  CONFIG_SINGLETON_IDS,
  normalizeDocument,
  resolveConfigIdentity,
  resourceId,
  schemaUrl,
  serializeDocument,
} from "./config-format.js";

const envelopeKeys = ["$schema", "kind", "metadata", "spec"];
const metadataKeys = ["generation", "ownership"];
const nonSingletonKinds = CONFIG_RESOURCE_KINDS.filter(
  (kind) => !CONFIG_SINGLETON_IDS[kind],
);

const resourceIdArbitrary = fc.oneof(
  fc.constantFrom("", " ", "\t\n", "\u0000", "__proto__", "constructor"),
  fc.string({ maxLength: 128 }),
  fc.string({ maxLength: 2048 }),
);

const nonStringIdArbitrary = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.array(fc.string({ maxLength: 16 }), { maxLength: 4 }),
  fc.dictionary(fc.string({ maxLength: 12 }), fc.jsonValue(), {
    maxKeys: 4,
  }),
);

function validDocumentArbitrary() {
  return fc
    .tuple(
      fc.constantFrom(...CONFIG_RESOURCE_KINDS),
      fc
        .string({ minLength: 1, maxLength: 64 })
        .filter((value) => value.trim().length > 0),
      fc.oneof(
        fc.constant({}),
        fc.record({ generation: fc.integer({ min: 1, max: 1000 }) }),
        fc.record({ ownership: fc.constantFrom("unmanaged", "file-managed") }),
        fc.record({
          generation: fc.integer({ min: 1, max: 1000 }),
          ownership: fc.constantFrom("unmanaged", "file-managed"),
        }),
      ),
    )
    .map(([kind, id, metadata]) => ({
      $schema: schemaUrl(kind),
      metadata,
      spec: CONFIG_SINGLETON_IDS[kind]
        ? {}
        : { [kind === "Client" ? "clientId" : "id"]: id },
    }));
}

function unknownKeyArbitrary(allowedKeys: string[]) {
  return fc
    .string({ minLength: 1, maxLength: 24 })
    .filter((key) => !allowedKeys.includes(key));
}

describe("config-format property-based fuzz tests", () => {
  test.prop([fc.string({ maxLength: 512 })], {
    numRuns: 150,
  })("resolves only canonical schema identities", (schema) => {
    try {
      const identity = resolveConfigIdentity({ $schema: schema });
      expect(CONFIG_RESOURCE_KINDS).toContain(identity.kind);
      expect(Number.isSafeInteger(identity.version)).toBe(true);
      expect(identity.version).toBeGreaterThan(0);
      expect(schemaUrl(identity.kind, identity.version)).toBe(schema);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  test.prop([fc.jsonValue({ maxDepth: 3 })], {
    numRuns: 150,
  })("normalizes arbitrary JSON envelopes safely", (input) => {
    try {
      const document = normalizeDocument(input);
      expect(CONFIG_RESOURCE_KINDS).toContain(document.kind);
      expect(document.$schema).toBe(
        schemaUrl(document.kind, resolveConfigIdentity(document).version),
      );
      expect(document.metadata).toEqual(expect.any(Object));
      expect(resourceId(document)).toEqual(expect.any(String));
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  test.prop([validDocumentArbitrary()], {
    numRuns: 100,
  })("keeps normalize and serialize stable", (document) => {
    const normalized = normalizeDocument(document);
    const serialized = serializeDocument(document);
    expect(serializeDocument(normalized)).toEqual(serialized);
    expect(normalizeDocument(serialized)).toEqual(normalized);
  });

  test.prop([
    validDocumentArbitrary(),
    unknownKeyArbitrary(envelopeKeys),
    fc.jsonValue({ maxDepth: 2 }),
  ])(
    "rejects arbitrary unknown envelope properties",
    (document, key, value) => {
      expect(() => normalizeDocument({ ...document, [key]: value })).toThrow(
        /Unknown configuration envelope property/,
      );
    },
  );

  test.prop([
    validDocumentArbitrary(),
    unknownKeyArbitrary(metadataKeys),
    fc.jsonValue({ maxDepth: 2 }),
  ])(
    "rejects arbitrary unknown metadata properties",
    (document, key, value) => {
      expect(() =>
        normalizeDocument({
          ...document,
          metadata: { ...document.metadata, [key]: value },
        }),
      ).toThrow(/Invalid configuration metadata/);
    },
  );

  test.prop([
    fc.constantFrom(...nonSingletonKinds),
    fc.oneof(resourceIdArbitrary, nonStringIdArbitrary),
  ])("handles arbitrary resource identifiers consistently", (kind, id) => {
    const field = kind === "Client" ? "clientId" : "id";
    const document = {
      $schema: schemaUrl(kind),
      spec: { [field]: id },
    };

    if (typeof id === "string" && id.trim().length > 0) {
      expect(resourceId(document)).toBe(id);
    } else {
      expect(() => resourceId(document)).toThrow(
        `Configuration spec.${field} is required`,
      );
    }

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
