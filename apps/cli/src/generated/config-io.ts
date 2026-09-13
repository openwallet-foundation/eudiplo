// Generated from apps/backend/src/shared/config-format/config-io.ts. Run pnpm schemas:sync.
import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/** Replace one file atomically. A failed write leaves the existing destination intact. */
export async function atomicWriteFile(
    path: string,
    data: string | Uint8Array,
): Promise<void> {
    const temporary = join(
        dirname(path),
        `.${basename(path)}.${randomUUID()}.tmp`,
    );
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
        file = await open(temporary, "wx", 0o600);
        await file.writeFile(data);
        await file.sync();
        await file.close();
        file = undefined;
        await rename(temporary, path);
    } finally {
        await file?.close();
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
        });
    }
}

