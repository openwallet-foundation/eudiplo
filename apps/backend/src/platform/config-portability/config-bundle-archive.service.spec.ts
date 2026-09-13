import { createHash } from "node:crypto";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { assertConfigBundle } from "../../shared/config-format/config-bundle.js";
import {
    migrateDocument,
    schemaUrl,
    serializeDocument,
} from "../../shared/config-format/config-format.js";
import { ConfigBundleArchiveService } from "./config-bundle-archive.service.js";
import type { ConfigBundle, ConfigDocument } from "./config-resource.types.js";

const hash = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");

function bundle(): ConfigBundle {
    const document: ConfigDocument = {
        $schema: schemaUrl("Tenant"),
        kind: "Tenant",
        metadata: { generation: 1, ownership: "unmanaged" },
        spec: { name: "Example" },
    };
    const asset = Buffer.from("image");
    return {
        manifest: {
            format: "eudiplo.config-bundle",
            formatVersion: 1,
            sourceVersion: "test",
            exportedAt: "2026-01-01T00:00:00.000Z",
            tenant: "tenant-a",
            resources: [
                {
                    kind: "Tenant",
                    id: "tenant",
                    $schema: document.$schema,
                    path: "info.json",
                    sha256: hash(JSON.stringify(document)),
                    ownership: "unmanaged",
                    generation: 1,
                },
            ],
            assets: [
                {
                    path: "images/logo.png",
                    contentType: "image/png",
                    sha256: hash(asset),
                },
            ],
            requirements: [],
            warnings: [],
        },
        documents: [document],
        assets: [
            {
                path: "images/logo.png",
                contentType: "image/png",
                sha256: hash(asset),
                data: asset.toString("base64"),
            },
        ],
    };
}

describe("ConfigBundleArchiveService", () => {
    const service = new ConfigBundleArchiveService();

    it("round-trips documents and binary assets", () => {
        const input = bundle();
        expect(service.decode(service.encode(input))).toEqual(input);
    });

    it("round-trips schema-based version 2 bundles", () => {
        const input = bundle();
        input.documents = input.documents.map((document) =>
            serializeDocument(migrateDocument(document, () => []).document),
        );
        input.manifest.formatVersion = 2;
        const resource = input.manifest.resources[0];
        resource.$schema = schemaUrl("Tenant");
        delete resource.apiVersion;
        resource.sha256 = hash(JSON.stringify(input.documents[0]));
        expect(service.decode(service.encode(input))).toEqual(input);
    });

    it("rejects path traversal in archive paths", () => {
        const input = bundle();
        input.manifest.resources[0].path = "../info.json";
        expect(() => service.encode(input)).toThrow("Unsafe bundle path");
    });

    it("rejects a stale document checksum", () => {
        const input = bundle();
        input.documents[0].spec.name = "Changed";
        expect(() => service.encode(input)).toThrow("checksum mismatch");
    });

    it("rejects an oversized expansion before decompressing entries", () => {
        const archive = service.encode(bundle());
        const centralDirectory = archive.indexOf(
            Buffer.from([0x50, 0x4b, 0x01, 0x02]),
        );
        expect(centralDirectory).toBeGreaterThanOrEqual(0);
        archive.writeUInt32LE(101 * 1024 * 1024, centralDirectory + 24);

        expect(() => service.decode(archive)).toThrow(
            "Expanded configuration ZIP exceeds 100 MiB",
        );
    });
    it.each([
        "duplicate identity",
        "duplicate path",
        "missing document",
        "missing asset",
        "invalid base64",
    ])("rejects %s in JSON and ZIP input", (scenario) => {
        const input = bundle();
        if (scenario === "duplicate identity") {
            input.manifest.resources.push({
                ...input.manifest.resources[0],
                path: "copy.json",
            });
            input.documents.push(input.documents[0]);
        }
        if (scenario === "duplicate path")
            input.manifest.assets[0].path = input.manifest.resources[0].path;
        if (scenario === "missing document") input.documents = [];
        if (scenario === "missing asset") input.assets = [];
        if (scenario === "invalid base64") input.assets[0].data = "%%%";
        expect(() => assertConfigBundle(input)).toThrow();
        expect(() => service.encode(input)).toThrow();
    });
    it("rejects ZIP entries not listed by the manifest", () => {
        const entries = unzipSync(service.encode(bundle()));
        entries["unexpected.json"] = strToU8("{}");
        expect(() => service.decode(Buffer.from(zipSync(entries)))).toThrow(
            "Unlisted",
        );
    });
    it("does not include JSON snippets in parse errors", () => {
        const entries = unzipSync(service.encode(bundle()));
        entries["manifest.json"] = strToU8('{"secret":"do-not-print",');
        try {
            service.decode(Buffer.from(zipSync(entries)));
            throw new Error("Expected invalid JSON");
        } catch (error) {
            expect(String(error)).toContain("Invalid JSON");
            expect(String(error)).not.toContain("do-not-print");
        }
    });
});
