// Generated from apps/backend/src/shared/config-format/config-io.ts. Run pnpm schemas:sync.
import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import {
    openSync,
    writeFileSync,
    fsyncSync,
    closeSync,
    renameSync,
    unlinkSync,
} from "node:fs";
import { dirname, basename, join } from "node:path";

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
export function atomicWriteFileSync(
    path: string,
    data: string | Uint8Array,
): void {
    const temporary = join(
        dirname(path),
        `.${basename(path)}.${randomUUID()}.tmp`,
    );
    let fd: number | undefined;
    try {
        fd = openSync(temporary, "wx", 0o600);
        writeFileSync(fd, data);
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        renameSync(temporary, path);
    } finally {
        if (fd !== undefined) closeSync(fd);
        try {
            unlinkSync(temporary);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }
}
