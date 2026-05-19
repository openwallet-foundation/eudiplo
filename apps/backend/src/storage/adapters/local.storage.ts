import {
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { FileStorage, type PutOptions } from "../storage.types";

/**
 * Local file storage implementation for development and testing.
 */
export class LocalFileStorage implements FileStorage {
    /**
     * Creates a new instance of LocalFileStorage.
     * @param baseDir
     */
    constructor(private readonly baseDir: string) {}

    /**
     * Saves a file to the local storage.
     * @param key
     * @param body
     */
    async put(
        key: string,
        body: Buffer | Readable,
        opts?: PutOptions,
    ): Promise<void> {
        const fullPath = join(this.baseDir, key);
        mkdirSync(dirname(fullPath), { recursive: true });

        await new Promise<void>((resolve, reject) => {
            const write = createWriteStream(fullPath);
            const src = body instanceof Readable ? body : Readable.from(body);
            src.pipe(write)
                .on("finish", () => resolve())
                .on("error", reject);
        });

        if (opts?.contentType) {
            writeFileSync(
                `${fullPath}.meta`,
                JSON.stringify({ contentType: opts.contentType }),
            );
        }
    }

    /**
     * Retrieves a file stream from the local storage.
     * @param key
     * @returns
     */
    getStream(key: string) {
        const fullPath = join(this.baseDir, key);
        const stat = statSync(fullPath);
        const metaPath = `${fullPath}.meta`;
        const contentType = existsSync(metaPath)
            ? JSON.parse(readFileSync(metaPath, "utf-8")).contentType
            : undefined;
        return Promise.resolve({
            stream: createReadStream(fullPath),
            contentType,
            size: stat.size,
        });
    }

    /**
     * Deletes a file from the local storage.
     * @param key
     * @returns
     */
    delete(key: string) {
        const fullPath = join(this.baseDir, key);
        rmSync(fullPath);
        const metaPath = `${fullPath}.meta`;
        if (existsSync(metaPath)) rmSync(metaPath);
        return Promise.resolve();
    }

    /**
     * Checks if a file exists in the local storage.
     * @param key
     * @returns
     */
    exists(key: string) {
        return Promise.resolve(existsSync(join(this.baseDir, key)));
    }
}
