import {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { atomicWriteFile, atomicWriteFileSync } from "./config-io.js";

describe.each(["async", "sync"])("%s atomic configuration writes", (mode) => {
    const write = async (path: string, data: string) =>
        mode === "async"
            ? atomicWriteFile(path, data)
            : atomicWriteFileSync(path, data);
    it("replaces contents with private permissions and cleans temporary files", async () => {
        const folder = await mkdtemp(join(tmpdir(), "config-write-"));
        try {
            const path = join(folder, "config.json");
            await writeFile(path, "old", { mode: 0o644 });
            await write(path, "new");
            expect(await readFile(path, "utf8")).toBe("new");
            expect((await stat(path)).mode & 0o777).toBe(0o600);
            expect(await readdir(folder)).toEqual(["config.json"]);
        } finally {
            await rm(folder, { recursive: true, force: true });
        }
    });
    it("leaves an existing destination intact when replacement fails", async () => {
        const folder = await mkdtemp(join(tmpdir(), "config-write-"));
        try {
            const path = join(folder, "destination");
            await mkdir(path);
            await writeFile(join(path, "original"), "preserved");
            await expect(write(path, "replacement")).rejects.toThrow();
            expect(await readFile(join(path, "original"), "utf8")).toBe(
                "preserved",
            );
            expect(await readdir(folder)).toEqual(["destination"]);
        } finally {
            await rm(folder, { recursive: true, force: true });
        }
    });
});
