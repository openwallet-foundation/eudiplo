import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { drivers } from "../src/drivers.js";
import { runCli } from "../src/runtime.js";
import type { CommandContext } from "../src/types.js";
import packageJson from "../package.json" with { type: "json" };

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

    it("treats -h like global help", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["-h"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Commands:");
        expect(output.stdout).toContain("--help");
    });

    it("prints command-specific help", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["init", "--help"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Usage:\n    eudiplo init --target compose [options]");
        expect(output.stdout).toContain("--target <compose|external>");
        expect(output.stdout).toContain("--instance <name>");
        expect(output.stdout).toContain("--demo");
        expect(output.stdout).toContain("--image-tag <tag>");
        expect(output.stdout).toContain("--no-client");
        expect(output.stdout).not.toContain("Commands:\n    eudiplo demo");
    });

    it("treats -h like command-specific help", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["init", "-h"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Usage:\n    eudiplo init --target compose [options]");
        expect(output.stdout).toContain("--no-client");
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

    it("uses the standalone installer when the binary has an update", async () => {
        const { context, output } = await createContext({
            fetch: async () => Response.json({ version: "99.0.0" }),
            installationMethod: "standalone",
        });

        const code = await runCli(["version"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain(
            "update available: curl -fsSL https://eudiplo.dev/install.sh | bash",
        );
        expect(output.stdout).not.toContain("npm install -g");
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

    it("initializes compose instances with standard compose assets by default", async () => {
        const { context, output, cwd } = await createContext();

        const code = await runCli(["init", "--target", "compose"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Initialized compose instance local.");
        await expect(readFile(join(cwd, "eudiplo.compose.yaml"), "utf8")).resolves.toContain(
            "EUDIPLO Docker Compose - Multi-Profile Deployment",
        );
        await expect(readFile(join(cwd, ".eudiplo.env"), "utf8")).resolves.not.toContain(
            "EUDIPLO_IMAGE=",
        );
        await expect(readFile(join(cwd, ".eudiplo.env"), "utf8")).resolves.toContain(
            "AUTH_CLIENT_ID=root",
        );
    });

    it("initializes compose demo instances with editable demo config when requested", async () => {
        const { context, output, cwd } = await createContext();

        const code = await runCli(["init", "--target", "compose", "--demo"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Initialized compose instance local.");
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            `EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:${packageJson.version}`,
        );
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            `EUDIPLO_CLIENT_IMAGE=ghcr.io/openwallet-foundation/eudiplo-client:${packageJson.version}`,
        );
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            "EUDIPLO_BIND_ADDRESS=127.0.0.1",
        );
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            "EUDIPLO_CONFIG_MOUNT=./.eudiplo/demo-config:/app/config",
        );
    });

    it("accepts demo image tag overrides", async () => {
        const { context, cwd } = await createContext();

        const code = await runCli(
            ["init", "--target", "compose", "--demo", "--image-tag", "main"],
            context,
        );

        expect(code).toBe(0);
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            "EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:main",
        );
        await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
            "EUDIPLO_CLIENT_IMAGE=ghcr.io/openwallet-foundation/eudiplo-client:main",
        );
    });

    it("initializes compose instances without the client when requested", async () => {
        const { context, output, cwd, configPath } = await createContext();

        const code = await runCli(["init", "--target", "compose", "--no-client"], context);

        expect(code).toBe(0);
        expect(output.stdout).toContain("Initialized compose instance local.");
        await expect(
            readFile(join(cwd, "eudiplo.compose.override.yaml"), "utf8"),
        ).resolves.toContain('profiles: ["disabled"]');

        const config = JSON.parse(await readFile(configPath, "utf8"));
        expect(config.instances.local.composeFiles).toEqual([
            "eudiplo.compose.yaml",
            "eudiplo.compose.override.yaml",
        ]);
        expect(config.instances.local.clientUrl).toBeUndefined();
    });

    it("removes the no-client override when reinitialized without the flag", async () => {
        const { context, cwd } = await createContext();

        expect(await runCli(["init", "--target", "compose", "--no-client"], context)).toBe(0);
        expect(await runCli(["init", "--target", "compose"], context)).toBe(0);

        await expect(
            readFile(join(cwd, "eudiplo.compose.override.yaml"), "utf8"),
        ).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("reports compose commands with the client enabled", async () => {
        const { context, output } = await createContext();
        const originalUp = drivers.compose.up;
        drivers.compose.up = async () => 0;

        try {
            expect(await runCli(["init", "--target", "compose"], context)).toBe(0);
            output.stdout = "";

            expect(await runCli(["up"], context)).toBe(0);
            expect(output.stdout).toContain("up local (client enabled)");
        } finally {
            drivers.compose.up = originalUp;
        }
    });

    it("reports compose commands with the client disabled", async () => {
        const { context, output } = await createContext();
        const originalLogs = drivers.compose.logs;
        drivers.compose.logs = async () => 0;

        try {
            expect(await runCli(["init", "--target", "compose", "--no-client"], context)).toBe(0);
            output.stdout = "";

            expect(await runCli(["logs"], context)).toBe(0);
            expect(output.stdout).toContain("logs local (client disabled)");
        } finally {
            drivers.compose.logs = originalLogs;
        }
    });

    it("demo generates local assets and starts compose", async () => {
        const { context, output, cwd } = await createContext();
        const originalUp = drivers.compose.up;
        drivers.compose.up = async () => 0;

        try {
            const code = await runCli(["demo"], context);

            expect(code).toBe(0);
            expect(output.stdout).toContain("Starting EUDIPLO demo with Docker Compose...");
            expect(output.stdout).toContain("Demo mode - not for production.");
            await expect(readFile(join(cwd, ".eudiplo.demo.env"), "utf8")).resolves.toContain(
                `EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:${packageJson.version}`,
            );
        } finally {
            drivers.compose.up = originalUp;
        }
    });

    it("init --demo does not overwrite existing demo config without --force", async () => {
        const { context, cwd } = await createContext();
        const customFile = join(cwd, ".eudiplo", "demo-config", "info.json");

        expect(await runCli(["init", "--target", "compose", "--demo"], context)).toBe(0);
        await writeFile(customFile, "custom-demo-config", "utf8");

        expect(await runCli(["init", "--target", "compose", "--demo"], context)).toBe(0);
        await expect(readFile(customFile, "utf8")).resolves.toBe("custom-demo-config");
    });

    it("demo --reset requires --force", async () => {
        const { context, output } = await createContext();

        const code = await runCli(["demo", "--reset"], context);

        expect(code).toBe(1);
        expect(output.stderr).toContain("demo --reset requires --force");
    });

    it("demo --reset --force removes only managed demo deployment data", async () => {
        const { context, cwd } = await createContext();
        const originalDown = drivers.compose.down;
        const originalUp = drivers.compose.up;
        const calls = [] as string[];
        drivers.compose.down = async (options) => {
            calls.push(options.args.join(" "));
            return 0;
        };
        drivers.compose.up = async () => 0;

        try {
            await writeFile(join(cwd, ".eudiplo.env"), "manual-env", "utf8");
            expect(await runCli(["demo"], context)).toBe(0);
            expect(await runCli(["demo", "--reset", "--force"], context)).toBe(0);
            await expect(readFile(join(cwd, ".eudiplo.env"), "utf8")).resolves.toBe("manual-env");
            expect(calls).toContain("--volumes --remove-orphans");
        } finally {
            drivers.compose.down = originalDown;
            drivers.compose.up = originalUp;
        }
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

async function createContext(
    options: {
        fetch?: typeof fetch;
        installationMethod?: CommandContext["installationMethod"];
    } = {},
) {
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
        installationMethod: options.installationMethod,
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
