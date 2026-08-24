import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConfigBundleArchiveService } from "./config-bundle-archive.service";
import type { ConfigBundle, ConfigDocument } from "./config-resource.types";

const hash = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");

function bundle(): ConfigBundle {
    const document: ConfigDocument = {
        apiVersion: "eudiplo.io/tenant/v1",
        kind: "Tenant",
        metadata: { id: "tenant", generation: 1, ownership: "unmanaged" },
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
                    apiVersion: document.apiVersion,
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
});
