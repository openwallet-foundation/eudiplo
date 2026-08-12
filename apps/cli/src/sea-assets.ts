import { readFile } from "node:fs/promises";
import { isSea, getAsset } from "node:sea";

export async function readCliTextAsset(assetKey: string, fileUrl: URL): Promise<string> {
    if (isSea()) {
        return getAsset(assetKey, "utf8") as string;
    }

    return readFile(fileUrl, "utf8");
}

export async function readCliBinaryAsset(assetKey: string, fileUrl: URL): Promise<Uint8Array> {
    if (isSea()) {
        const value = getAsset(assetKey) as string | ArrayBuffer | Uint8Array;
        if (value instanceof Uint8Array) {
            return value;
        }
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }
        return Buffer.from(value, "utf8");
    }

    return readFile(fileUrl);
}