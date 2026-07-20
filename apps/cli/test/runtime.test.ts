import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/runtime.js";
import type { CommandContext } from "../src/types.js";

describe("EUDIPLO CLI", () => {
    it("prints command descriptions in help", async () => {
        const { context, output } = await createContext();

        const code = await runCli([], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Commands:");
        expect(output.stdout).toContain(
            "eudiplo demo                         Creates and starts a local Docker Compose demo.",
        );
        expect(output.stdout).toContain("Options:");
        expect(output.stdout).toContain("--version, -v");
        expect(output.stdout).toContain("For more information");
    });

    it("prints command-specific help", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["init", "--help"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Usage:\n    eudiplo init --target compose [options]");
        expect(output.stdout).toContain("--target <compose|external>");
        expect(output.stdout).toContain("--instance <name>");
        expect(output.stdout).not.toContain("Commands:\n    eudiplo demo");
    });

    it("prints the package version", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["--version"], context);

        expect(code).toBe(0);
        expect(output.stdout).toMatch(/^@eudiplo\/cli \d+\.\d+\.\d+/);
    });

    it("keeps short version aliases local-only", async () => {
        const { context, output } = await createContext();

        expect(await runCli(["-v"], context)).toBe(0);
        expect(output.stdout).toMatch(/@eudiplo\/cli \d+\.\d+\.\d+/);
        expect(output.stdout).not.toContain("latest");
    });

    it("checks the latest published version", async () => {
        const { context, output } = await createContext({
            fetch: async () => Response.json({ version: "99.0.0" }),
        });

        const code = await runCli(["version"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("@eudiplo/cli");
        expect(output.stdout).toContain("latest 99.0.0");
        expect(output.stdout).toContain("update available: npm install -g @eudiplo/cli@latest");
    });

    it("does not fail version output when the registry is unavailable", async () => {
        const { context, output } = await createContext({
            fetch: async () => new Response("not found", { status: 404 }),
        });

        const code = await runCli(["version"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("latest unavailable: npm registry returned HTTP 404");
    });

    it("registers an external instance without storing secrets", async () => {
        const { context, output, configPath } = await createContext();

        const code = await runCli(
            ["instance", "add", "production", "--url", "https://eudiplo.example.com"],
            context,
        );

        expect(code).toBe(0);
        expect(output.stdout).toContain("Added external instance production.");

        const config = JSON.parse(await readFile(configPath, "utf8"));
        expect(config.instances.production).toEqual({
            target: "external",
            url: "https://eudiplo.example.com",
        });
        expect(JSON.stringify(config)).not.toContain("secret");
    });

    it("rejects compose-only commands for external instances", async () => {
        const { context, output } = await createContext();
        await runCli(
            ["instance", "add", "production", "--url", "https://eudiplo.example.com"],
            context,
        );

        const code = await runCli(["logs", "--instance", "production"], context);

        expect(code).toBe(1);
        expect(output.stderr).toContain(
            "logs is not available for externally managed deployments",
        );
    });

    it("initializes compose instances with demo compose assets", async () => {
        const { context, output, cwd } = await createContext();

        const code = await runCli(["init", "--target", "compose"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Initialized compose instance local.");
        await expect(readFile(join(cwd, "eudiplo.compose.yaml"), "utf8")).resolves.toContain(
            "EUDIPLO Docker Compose - Multi-Profile Deployment",
        );
        await expect(readFile(join(cwd, ".eudiplo.env"), "utf8")).resolves.toContain(
            "ghcr.io/openwallet-foundation/eudiplo-demo:main",
        );
        await expect(readFile(join(cwd, ".eudiplo.env"), "utf8")).resolves.toContain(
            "AUTH_CLIENT_ID=root",
        );
    });

    it("runs doctor against external instances without Docker diagnostics", async () => {
        const { context, output } = await createContext({
            fetch: async (input) => {
                const url = input instanceof URL ? input : new URL(String(input));
                return new Response("{}", {
                    status: url.pathname === "/health" || url.pathname === "/api/docs" ? 200 : 404,
                });
            },
        });
        await runCli(
            ["instance", "add", "production", "--url", "https://eudiplo.example.com"],
            context,
        );

        const code = await runCli(["doctor", "--instance", "production"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("PASS API reachability");
        expect(output.stdout).toContain("PASS health endpoint");
        expect(output.stdout).not.toContain("Docker is not available");
    });

    it("validates config and reports configured instances", async () => {
        const { context, output } = await createContext();
        await runCli(
            ["instance", "add", "production", "--url", "https://eudiplo.example.com"],
            context,
        );

        const code = await runCli(["config", "validate"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Config is valid:");
        expect(output.stdout).toContain("Instances: 1");
        expect(output.stdout).toContain("- production: external https://eudiplo.example.com");
    });

    it("rejects invalid config URLs", async () => {
        const { context, output, configPath } = await createContext();
        await writeFile(
            configPath,
            JSON.stringify({
                instances: {
                    production: {
                        target: "external",
                        url: "not-a-url",
                    },
                },
            }),
            "utf8",
        );

        const code = await runCli(["config", "validate"], context);

        expect(code).toBe(1);
        expect(output.stderr).toContain(
            "Instance production url must be an absolute HTTP(S) URL.",
        );
    });

    it("requires the config validate subcommand", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["config", "show"], context);

        expect(code).toBe(1);
        expect(output.stderr).toContain("Usage: eudiplo config validate");
    });
});

async function createContext(options: { fetch?: typeof fetch } = {}) {
    const cwd = await mkdtemp(join(tmpdir(), "eudiplo-cli-work-"));
    const home = await mkdtemp(join(tmpdir(), "eudiplo-cli-home-"));
    const configPath = join(home, "config.json");
    const output = { stdout: "", stderr: "" };
    const context: CommandContext = {
        cwd,
        env: {
            EUDIPLO_CLI_CONFIG: configPath,
            PATH: process.env.PATH,
        },
        stdout: {
            write(chunk: string | Uint8Array) {
                output.stdout += String(chunk);
                return true;
            },
        },
        stderr: {
            write(chunk: string | Uint8Array) {
                output.stderr += String(chunk);
                return true;
            },
        },
        fetch: options.fetch ?? fetch,
    };

    return { context, output, cwd, configPath };
}