import { createHash } from "node:crypto";
import {
    access,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { schemaUrl } from "../src/generated/config-format.js";
import { runCli } from "../src/runtime.js";
import type { CommandContext } from "../src/types.js";

const folders: string[] = [];
afterEach(async () => {
    await Promise.all(
        folders
            .splice(0)
            .map((folder) => rm(folder, { recursive: true, force: true })),
    );
});
async function setup() {
    const cwd = await mkdtemp(join(tmpdir(), "eudiplo-upgrade-"));
    folders.push(cwd);
    const output = { stdout: "", stderr: "" };
    const context: CommandContext = {
        cwd,
        env: {},
        stdout: {
            write: (text) => {
                output.stdout += String(text);
                return true;
            },
        },
        stderr: {
            write: (text) => {
                output.stderr += String(text);
                return true;
            },
        },
        fetch: vi.fn(() => {
            throw new Error("Upgrade must remain offline");
        }),
    };
    return { cwd, context, output };
}
const legacy = {
    apiVersion: "eudiplo.dev/tenant/v1",
    kind: "Tenant",
    metadata: { id: "tenant", generation: 4 },
    spec: { name: "Example" },
};
const hash = (value: string | Uint8Array) =>
    createHash("sha256").update(value).digest("hex");
function bundle() {
    return {
        manifest: {
            format: "eudiplo.config-bundle",
            formatVersion: 1,
            tenant: "test",
            resources: [
                {
                    kind: "Tenant",
                    id: "tenant",
                    apiVersion: legacy.apiVersion,
                    path: "info.json",
                    sha256: hash(JSON.stringify(legacy)),
                },
            ],
            assets: [],
        },
        documents: [legacy],
        assets: [],
    };
}
describe("config upgrade", () => {
    it("rewrites the legacy envelope offline and preserves source and generation", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "tenant.json");
        await writeFile(source, JSON.stringify(legacy));
        expect(await runCli(["config", "upgrade", source], context)).toBe(0);
        expect(
            JSON.parse(await readFile(`${source}.upgraded.json`, "utf8")),
        ).toEqual({
            $schema: schemaUrl("Tenant"),
            metadata: { generation: legacy.metadata.generation },
            spec: legacy.spec,
        });
        expect(JSON.parse(await readFile(source, "utf8"))).toEqual(legacy);
        expect(context.fetch).not.toHaveBeenCalled();
    });
    it("updates legacy singleton manifest IDs along with the document", async () => {
        const { cwd, context } = await setup();
        const input = bundle();
        input.documents = [
            {
                ...legacy,
                metadata: { ...legacy.metadata, id: "old-tenant-name" },
            },
        ];
        input.manifest.resources[0].id = "old-tenant-name";
        input.manifest.resources[0].sha256 = hash(
            JSON.stringify(input.documents[0]),
        );
        const source = join(cwd, "bundle.json");
        await writeFile(source, JSON.stringify(input));
        expect(await runCli(["config", "upgrade", source], context)).toBe(0);
        const output = JSON.parse(
            await readFile(`${source}.upgraded.json`, "utf8"),
        );
        expect(output.manifest.resources[0].id).toBe("tenant");
        expect(output.documents[0].metadata).toEqual({ generation: 4 });
    });
    it("writes nothing for dry-run or invalid input", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "tenant.json");
        await writeFile(source, JSON.stringify(legacy));
        expect(
            await runCli(["config", "upgrade", source, "--dry-run"], context),
        ).toBe(0);
        await expect(access(`${source}.upgraded.json`)).rejects.toThrow();
        await writeFile(
            source,
            JSON.stringify({ ...legacy, spec: { name: 123 } }),
        );
        expect(await runCli(["config", "upgrade", source], context)).toBe(1);
        await expect(access(`${source}.upgraded.json`)).rejects.toThrow();
    });
    it("upgrades JSON bundle identifiers and checksums together", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "bundle.json");
        await writeFile(source, JSON.stringify(bundle()));
        expect(await runCli(["config", "upgrade", source], context)).toBe(0);
        const result = JSON.parse(
            await readFile(`${source}.upgraded.json`, "utf8"),
        );
        expect(result.manifest.formatVersion).toBe(2);
        expect(result.manifest.resources[0].$schema).toBe(schemaUrl("Tenant"));
        expect(result.manifest.resources[0].apiVersion).toBeUndefined();
        expect(result.manifest.resources[0].sha256).toBe(
            hash(JSON.stringify(result.documents[0])),
        );
    });
    it("upgrades ZIP bundles and preserves assets", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "bundle.zip");
        await writeFile(
            source,
            zipSync({
                "manifest.json": strToU8(
                    JSON.stringify({
                        ...bundle().manifest,
                        assets: [
                            {
                                path: "images/logo.png",
                                sha256: hash("image"),
                                contentType: "image/png",
                            },
                        ],
                    }),
                ),
                "info.json": strToU8(JSON.stringify(legacy)),
                "images/logo.png": strToU8("image"),
            }),
        );
        expect(await runCli(["config", "upgrade", source], context)).toBe(0);
        const result = unzipSync(await readFile(`${source}.upgraded.zip`));
        const manifest = JSON.parse(strFromU8(result["manifest.json"]));
        expect(manifest.formatVersion).toBe(2);
        expect(manifest.resources[0].sha256).toBe(hash(result["info.json"]));
        expect(JSON.parse(strFromU8(result["info.json"])).$schema).toBe(
            schemaUrl("Tenant"),
        );
        expect(strFromU8(result["images/logo.png"])).toBe("image");
    });
    it("refuses corrupt bundle checksums", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "bundle.json");
        const input = bundle();
        input.manifest.resources[0].sha256 = "invalid";
        await writeFile(source, JSON.stringify(input));
        expect(await runCli(["config", "upgrade", source], context)).toBe(1);
        await expect(access(`${source}.upgraded.json`)).rejects.toThrow();
    });
    it("checks and upgrades tenant folders without changing sources or dropping assets", async () => {
        const { cwd, context, output } = await setup();
        const source = join(cwd, "tenant-folder");
        await mkdir(join(source, "images"), { recursive: true });
        await writeFile(
            join(source, "info.json"),
            JSON.stringify({ name: "Example" }),
        );
        await writeFile(join(source, "images", "logo.png"), "image");
        expect(
            await runCli(
                ["config", "upgrade", source, "--check", "--diff"],
                context,
            ),
        ).toBe(1);
        expect(output.stdout).toContain("1 require upgrading");
        await expect(access(`${source}.upgraded`)).rejects.toThrow();
        expect(await runCli(["config", "upgrade", source], context)).toBe(0);
        const result = JSON.parse(
            await readFile(join(`${source}.upgraded`, "info.json"), "utf8"),
        );
        expect(result).toMatchObject({
            $schema: schemaUrl("Tenant"),
            spec: { name: "Example" },
        });
        expect(
            await readFile(
                join(`${source}.upgraded`, "images", "logo.png"),
                "utf8",
            ),
        ).toBe("image");
        expect(
            await runCli(
                ["config", "upgrade", `${source}.upgraded`, "--check"],
                context,
            ),
        ).toBe(0);
        expect(await runCli(["config", "upgrade", source], context)).toBe(1);
        expect(
            JSON.parse(await readFile(join(source, "info.json"), "utf8")),
        ).toEqual({ name: "Example" });
    });
    it("validates the entire folder before writing any output", async () => {
        const { cwd, context } = await setup();
        const source = join(cwd, "folder");
        await mkdir(join(source, "clients"), { recursive: true });
        await writeFile(
            join(source, "info.json"),
            JSON.stringify({ name: "Example" }),
        );
        await writeFile(
            join(source, "clients", "invalid.json"),
            JSON.stringify({ clientId: 123 }),
        );
        expect(await runCli(["config", "upgrade", source], context)).toBe(1);
        await expect(access(`${source}.upgraded`)).rejects.toThrow();
    });
    it("does not expose secrets in a legacy folder upgrade diff", async () => {
        const { cwd, context, output } = await setup();
        const source = join(cwd, "folder");
        await mkdir(join(source, "clients"), { recursive: true });
        await writeFile(
            join(source, "clients", "client.json"),
            JSON.stringify({
                clientId: "client",
                secret: "never-print-this",
                roles: ["clients:manage"],
            }),
        );
        expect(
            await runCli(
                ["config", "upgrade", source, "--check", "--diff"],
                context,
            ),
        ).toBe(1);
        expect(output.stdout).toContain("[redacted]");
        expect(output.stdout + output.stderr).not.toContain("never-print-this");
    });
});
