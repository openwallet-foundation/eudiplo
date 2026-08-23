import { createHash } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type {
    ConfigBundle,
    ConfigBundleAsset,
    ConfigDocument,
} from "./config-resource.types";

const sha256 = (value: Uint8Array): string =>
    createHash("sha256").update(value).digest("hex");

@Injectable()
export class ConfigBundleArchiveService {
    encode(bundle: ConfigBundle): Buffer {
        const entries: Record<string, Uint8Array> = {
            "manifest.json": strToU8(JSON.stringify(bundle.manifest, null, 2)),
        };
        for (const resource of bundle.manifest.resources) {
            this.assertSafePath(resource.path);
            const document = bundle.documents.find(
                (candidate) =>
                    candidate.kind === resource.kind &&
                    candidate.apiVersion === resource.apiVersion &&
                    candidate.metadata.id === resource.id,
            );
            if (!document) {
                throw new BadRequestException(
                    `Bundle document is missing for ${resource.kind} at ${resource.path}`,
                );
            }
            const bytes = strToU8(JSON.stringify(document));
            if (sha256(bytes) !== resource.sha256) {
                throw new BadRequestException(
                    `Resource checksum mismatch while packing ${resource.path}`,
                );
            }
            entries[resource.path] = bytes;
        }
        for (const asset of bundle.assets ?? []) {
            this.assertSafePath(asset.path);
            const bytes = new Uint8Array(Buffer.from(asset.data, "base64"));
            if (sha256(bytes) !== asset.sha256) {
                throw new BadRequestException(
                    `Asset checksum mismatch while packing ${asset.path}`,
                );
            }
            entries[asset.path] = bytes;
        }
        return Buffer.from(zipSync(entries, { level: 6 }));
    }

    decode(input: Buffer): ConfigBundle {
        if (input.byteLength > 50 * 1024 * 1024) {
            throw new BadRequestException("Configuration ZIP exceeds 50 MiB");
        }
        this.inspectCentralDirectory(input);
        let entries: Record<string, Uint8Array>;
        try {
            entries = unzipSync(new Uint8Array(input));
        } catch (error) {
            throw new BadRequestException(
                `Invalid configuration ZIP: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        for (const path of Object.keys(entries)) this.assertSafePath(path);
        const expandedSize = Object.values(entries).reduce(
            (total, value) => total + value.byteLength,
            0,
        );
        if (expandedSize > 100 * 1024 * 1024) {
            throw new BadRequestException(
                "Expanded configuration ZIP exceeds 100 MiB",
            );
        }
        const manifestBytes = entries["manifest.json"];
        if (!manifestBytes) {
            throw new BadRequestException(
                "Configuration ZIP has no manifest.json",
            );
        }
        const manifest = this.parseJson(
            strFromU8(manifestBytes),
            "manifest.json",
        ) as ConfigBundle["manifest"];
        const documents: ConfigDocument[] = [];
        for (const resource of manifest.resources ?? []) {
            this.assertSafePath(resource.path);
            const bytes = entries[resource.path];
            if (!bytes) {
                throw new BadRequestException(
                    `Missing resource: ${resource.path}`,
                );
            }
            if (sha256(bytes) !== resource.sha256) {
                throw new BadRequestException(
                    `Resource checksum mismatch: ${resource.path}`,
                );
            }
            documents.push(
                this.parseJson(
                    strFromU8(bytes),
                    resource.path,
                ) as ConfigDocument,
            );
        }
        const assets: ConfigBundleAsset[] = (manifest.assets ?? []).map(
            (asset) => {
                this.assertSafePath(asset.path);
                const bytes = entries[asset.path];
                if (!bytes || sha256(bytes) !== asset.sha256) {
                    throw new BadRequestException(
                        `Missing or invalid asset: ${asset.path}`,
                    );
                }
                return {
                    ...asset,
                    data: Buffer.from(bytes).toString("base64"),
                };
            },
        );
        return { manifest, documents, assets };
    }

    private assertSafePath(path: string): void {
        if (
            !path ||
            path.startsWith("/") ||
            path.includes("\\") ||
            path.split("/").some((part) => part === ".." || part === "")
        ) {
            throw new BadRequestException(`Unsafe bundle path: ${path}`);
        }
    }

    /**
     * Read central-directory metadata before fflate allocates expanded entry
     * buffers. This makes the expanded-size limit effective against ZIP bombs.
     */
    private inspectCentralDirectory(input: Buffer): void {
        const eocdSignature = 0x06054b50;
        const centralSignature = 0x02014b50;
        const minimumEocdOffset = Math.max(0, input.length - 65_557);
        let eocd = -1;
        for (
            let offset = input.length - 22;
            offset >= minimumEocdOffset;
            offset--
        ) {
            if (input.readUInt32LE(offset) === eocdSignature) {
                eocd = offset;
                break;
            }
        }
        if (eocd < 0) {
            throw new BadRequestException(
                "Invalid configuration ZIP directory",
            );
        }
        const entryCount = input.readUInt16LE(eocd + 10);
        const centralSize = input.readUInt32LE(eocd + 12);
        const centralOffset = input.readUInt32LE(eocd + 16);
        if (
            entryCount === 0xffff ||
            centralSize === 0xffffffff ||
            centralOffset === 0xffffffff
        ) {
            throw new BadRequestException(
                "ZIP64 configuration archives are not supported",
            );
        }
        if (entryCount > 10_000) {
            throw new BadRequestException(
                "Configuration ZIP contains too many entries",
            );
        }
        if (centralOffset + centralSize > eocd) {
            throw new BadRequestException(
                "Invalid configuration ZIP directory",
            );
        }
        let offset = centralOffset;
        let expandedSize = 0;
        const paths = new Set<string>();
        for (let index = 0; index < entryCount; index++) {
            if (
                offset + 46 > input.length ||
                input.readUInt32LE(offset) !== centralSignature
            ) {
                throw new BadRequestException(
                    "Invalid configuration ZIP directory entry",
                );
            }
            const flags = input.readUInt16LE(offset + 8);
            if ((flags & 1) !== 0) {
                throw new BadRequestException(
                    "Encrypted ZIP entries are not supported",
                );
            }
            const uncompressedSize = input.readUInt32LE(offset + 24);
            if (uncompressedSize === 0xffffffff) {
                throw new BadRequestException(
                    "ZIP64 configuration entries are not supported",
                );
            }
            expandedSize += uncompressedSize;
            if (expandedSize > 100 * 1024 * 1024) {
                throw new BadRequestException(
                    "Expanded configuration ZIP exceeds 100 MiB",
                );
            }
            const filenameLength = input.readUInt16LE(offset + 28);
            const extraLength = input.readUInt16LE(offset + 30);
            const commentLength = input.readUInt16LE(offset + 32);
            const nextOffset =
                offset + 46 + filenameLength + extraLength + commentLength;
            if (nextOffset > input.length) {
                throw new BadRequestException(
                    "Invalid configuration ZIP directory entry length",
                );
            }
            const path = input
                .subarray(offset + 46, offset + 46 + filenameLength)
                .toString("utf8");
            this.assertSafePath(path);
            if (paths.has(path)) {
                throw new BadRequestException(
                    `Duplicate configuration ZIP path: ${path}`,
                );
            }
            paths.add(path);
            offset = nextOffset;
        }
        if (offset !== centralOffset + centralSize) {
            throw new BadRequestException(
                "Invalid configuration ZIP directory size",
            );
        }
    }

    private parseJson(value: string, path: string): unknown {
        try {
            return JSON.parse(value);
        } catch (error) {
            throw new BadRequestException(
                `Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
