import { readFile } from "node:fs/promises";
import { getAsset, isSea } from "node:sea";

type CliAssetFallback = URL | (() => URL);

/**
 * Base URL for the `templates/` directory, computed relative to this module.
 *
 * This file lives at the same directory depth as `index.ts` (the CLI entry
 * point), so its `import.meta.url` stays stable whether the build preserves
 * the original `src/` folder structure (`pnpm build`) or bundles everything
 * into a single `dist/index.js` (`build:publish` / `build:sea`): esbuild
 * rewrites every bundled module's `import.meta.url` to the output file's URL,
 * which sits at the same depth. Consumers must derive template asset URLs
 * from this constant rather than computing their own relative path from
 * `import.meta.url`, since their original source depth is not preserved once
 * bundled.
 */
const templatesBaseUrl = new URL("../templates/", import.meta.url);

export function templateAssetUrl(relativePath: string): URL {
    return new URL(relativePath, templatesBaseUrl);
}

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
