import { readFile } from "node:fs/promises";
import { getAsset, isSea } from "node:sea";

type CliAssetFallback = URL | (() => URL);

export async function readCliTextAsset(
    assetKey: string,
    fileUrl: CliAssetFallback,
): Promise<string> {
    if (isSea()) {
        return getAsset(assetKey, "utf8") as string;
    }

    return readFile(resolveFallback(fileUrl), "utf8");
}

export async function readCliBinaryAsset(
    assetKey: string,
    fileUrl: CliAssetFallback,
): Promise<Uint8Array> {
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

    return readFile(resolveFallback(fileUrl));
}

function resolveFallback(fallback: CliAssetFallback): URL {
    return typeof fallback === "function" ? fallback() : fallback;
}
