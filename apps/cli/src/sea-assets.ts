import { readFile } from "node:fs/promises";
import { isSea, getAsset } from "node:sea";

export async function readCliTextAsset(assetKey: string, fileUrl: URL): Promise<string> {
    if (isSea()) {
        return getAsset(assetKey, "utf8") as string;
    }

    return readFile(fileUrl, "utf8");
}