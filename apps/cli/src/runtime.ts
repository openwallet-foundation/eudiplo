import { parseArgs, readStringFlag } from "./args.js";
import { loadConfig, resolveConfigPath, saveConfig, upsertInstance } from "./config.js";
import { drivers, ensureComposeProject, unsupportedCommand } from "./drivers.js";
import { formatChecks, hasFailedChecks, runDoctor } from "./doctor.js";
import packageJson from "../package.json" with { type: "json" };
import type { CliConfig, CommandContext, DeploymentTarget, ParsedArgs } from "./types.js";

export async function runCli(
    args: string[],
    context: CommandContext = defaultContext(),
): Promise<number> {
    const parsed = parseArgs(args);
    if (parsed.command === "-v" || parsed.command === "--version" || parsed.flags.version === true) {
        context.stdout.write(`${versionText()}\n`);
        return 0;
    }
    if (parsed.command === "version") {
        context.stdout.write(`${await versionStatusText(context)}\n`);
        return 0;
    }
    if (parsed.command && parsed.flags.help === true) {
        context.stdout.write(`${commandHelpText(parsed.command)}\n`);
        return 0;
    }
    if (!parsed.command || parsed.command === "help") {
        context.stdout.write(`${helpText()}\n`);
        return 0;
    }

    try {
        return await dispatch(parsed, context);
    } catch (error) {
        context.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}

function defaultContext(): CommandContext {
    return {
        cwd: process.cwd(),
        env: process.env,
        stdout: process.stdout,
        stderr: process.stderr,
        fetch,
    };
}

async function dispatch(parsed: ParsedArgs, context: CommandContext): Promise<number> {
    const configPath = resolveConfigPath(context.env);
    const config = await loadConfig(configPath);

    switch (parsed.command) {
        case "init":
            return init(configPath, config, parsed, context);
        case "demo":
            return demo(configPath, config, context);
        case "instance":
            return instance(configPath, config, parsed, context);
        case "config":
            return validateConfigCommand(configPath, parsed, context);
        case "doctor":
            return doctor(config, parsed, context);
        case "status":
            return status(config, parsed, context);
        case "up":
        case "down":
        case "logs":
            return driverCommand(config, parsed.command, parsed, context);
        default:
            throw new Error(`Unknown command: ${parsed.command}`);
    }
}

async function init(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const target = parseTarget(readStringFlag(parsed.flags, "target") ?? "compose");
    const name = readStringFlag(parsed.flags, "instance") ?? "local";
    const url = readStringFlag(parsed.flags, "url");
    const useDemoImage = parsed.flags.demo === true;
    const noClient = parsed.flags["no-client"] === true;

    if (target === "compose") {
        const instance = await ensureComposeProject(context.cwd, { useDemoImage, noClient });
        const nextConfig = upsertInstance(config, name, {
            ...instance,
            url: url ?? instance.url,
        });
        await saveConfig(configPath, nextConfig);
        context.stdout.write(
            `Initialized compose instance ${name}. Run npx @eudiplo/cli up to start it.\n`,
        );
        return 0;
    }

    if (!url) {
        throw new Error("External instances require --url.");
    }

    const nextConfig = upsertInstance(config, name, { target, url });
    await saveConfig(configPath, nextConfig);
    context.stdout.write(`Initialized external instance ${name}.\n`);
    return 0;
}

async function demo(
    configPath: string,
    config: CliConfig,
    context: CommandContext,
): Promise<number> {
    const instance = await ensureComposeProject(context.cwd, { useDemoImage: true });
    const nextConfig = upsertInstance(config, "local", instance);
    await saveConfig(configPath, nextConfig);
    context.stdout.write("Starting EUDIPLO demo with Docker Compose...\n");
    return drivers.compose.up?.({
        instanceName: "local",
        instance,
        args: [],
        context,
    }) ?? 1;
}

async function instance(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    if (parsed.subject !== "add") {
        throw new Error("Usage: eudiplo instance add <name> --url <url> [--target external]");
    }

    const name = parsed.positionals[0];
    if (!name) {
        throw new Error("Instance name is required.");
    }

    const url = readStringFlag(parsed.flags, "url");
    if (!url) {
        throw new Error("--url is required.");
    }

    const target = parseTarget(readStringFlag(parsed.flags, "target") ?? "external");
    const clientUrl = readStringFlag(parsed.flags, "client-url");
    const nextConfig = upsertInstance(config, name, { target, url, clientUrl });
    await saveConfig(configPath, nextConfig);
    context.stdout.write(`Added ${target} instance ${name}.\n`);
    return 0;
}

async function validateConfigCommand(
    configPath: string,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    if (parsed.subject !== "validate") {
        throw new Error("Usage: eudiplo config validate");
    }

    const config = await loadConfig(configPath);
    const instanceNames = Object.keys(config.instances);
    context.stdout.write(`Config is valid: ${configPath}\n`);
    context.stdout.write(`Instances: ${instanceNames.length}\n`);
    if (config.defaultInstance) {
        context.stdout.write(`Default instance: ${config.defaultInstance}\n`);
    }
    for (const name of instanceNames) {
        const instance = config.instances[name];
        context.stdout.write(`- ${name}: ${instance.target} ${instance.url}\n`);
    }
    return 0;
}

async function doctor(
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const [instanceName, instance] = resolveInstance(config, parsed);
    const driver = drivers[instance.target];
    const checks = await runDoctor(
        instance,
        context,
        await driver.diagnostics(instance, context),
    );
    context.stdout.write(`Doctor for ${instanceName} (${instance.target})\n`);
    context.stdout.write(`${formatChecks(checks)}\n`);
    return hasFailedChecks(checks) ? 1 : 0;
}

async function status(
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const [instanceName, instance] = resolveInstance(config, parsed);
    const checks = await runDoctor(instance, context, []);
    const health = checks.find((check) => check.name === "health endpoint");
    context.stdout.write(`${instanceName} (${instance.target}) ${instance.url}\n`);
    if (health) {
        context.stdout.write(`${health.status.toUpperCase()} ${health.message}\n`);
    }
    return health?.status === "fail" ? 1 : 0;
}

async function driverCommand(
    config: CliConfig,
    command: "up" | "down" | "logs",
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const [instanceName, instance] = resolveInstance(config, parsed);
    const driver = drivers[instance.target];
    const handler = driver[command];
    if (!handler) {
        throw new Error(unsupportedCommand(command, instance.target));
    }
    if (instance.target === "compose") {
        context.stdout.write(
            `${command} ${instanceName} (${composeClientMode(instance)})\n`,
        );
    }
    return handler({ instanceName, instance, args: parsed.positionals, context });
}

function resolveInstance(
    config: CliConfig,
    parsed: ParsedArgs,
): [string, CliConfig["instances"][string]] {
    const name = readStringFlag(parsed.flags, "instance") ?? config.defaultInstance;
    if (!name) {
        throw new Error("No instance selected. Use --instance or add an instance first.");
    }
    const instance = config.instances[name];
    if (!instance) {
        throw new Error(`Unknown instance: ${name}`);
    }
    return [name, instance];
}

function parseTarget(value: string): DeploymentTarget {
    if (value === "compose" || value === "external") {
        return value;
    }
    throw new Error(`Unsupported target: ${value}`);
}

function composeClientMode(instance: CliConfig["instances"][string]): string {
    return instance.clientUrl ? "client enabled" : "client disabled";
}

function helpText(): string {
    return `EUDIPLO CLI

Usage:
    eudiplo <command> [options]

Commands:
    eudiplo demo                         Creates and starts a local Docker Compose demo.
    eudiplo init --target compose        Creates local Compose assets; add --demo or --no-client as needed.
    eudiplo up                           Starts the selected Compose deployment.
    eudiplo down                         Stops the selected Compose deployment.
    eudiplo logs                         Streams logs for the selected Compose deployment.
    eudiplo instance add <name> --url    Registers an existing EUDIPLO deployment.
    eudiplo doctor                       Checks API reachability, health, config, and client connectivity.
    eudiplo status                       Prints the selected instance status.
    eudiplo config validate              Validates the local CLI configuration file.
    eudiplo version                      Prints the installed version and checks npm for updates.

Options:
    --instance <name>                    Selects a configured instance.
    --target <compose|external>          Selects the deployment target for init/add.
    --url <url>                          Sets the EUDIPLO API URL for an instance.
    --client-url <url>                   Sets the optional web client URL for an instance.
    --no-client                          Skips the web client for compose init.
    --help                               Shows this help message.
    --version, -v                        Prints the installed CLI version without network access.

One-off npm usage:
    npx @eudiplo/cli demo

For more information, see https://openwallet-foundation.github.io/eudiplo/docs/latest/getting-started/cli/`;
}

function commandHelpText(command: string): string {
    switch (command) {
        case "demo":
            return `EUDIPLO CLI

Usage:
    eudiplo demo

Creates local demo assets and starts EUDIPLO with Docker Compose.

Options:
    --help                               Shows this help message.`;
        case "init":
            return `EUDIPLO CLI

Usage:
    eudiplo init --target compose [options]

Creates local deployment assets without starting them.

Options:
    --target <compose|external>          Selects the deployment target. Defaults to compose.
    --instance <name>                    Names the instance in CLI config. Defaults to local.
    --demo                               Uses the demo image instead of the standard image.
    --no-client                          Omits the web client from the local Compose setup.
    --url <url>                          Overrides the instance API URL.
    --help                               Shows this help message.`;
        case "up":
        case "down":
        case "logs":
            return `EUDIPLO CLI

Usage:
    eudiplo ${command} [--instance name]

${driverCommandDescription(command)}

Options:
    --instance <name>                    Selects a configured Compose instance.
    --help                               Shows this help message.`;
        case "instance":
            return `EUDIPLO CLI

Usage:
    eudiplo instance add <name> --url <url> [options]

Registers an existing EUDIPLO deployment in the local CLI config.

Options:
    --target <compose|external>          Selects the deployment target. Defaults to external.
    --url <url>                          Sets the EUDIPLO API URL.
    --client-url <url>                   Sets the optional web client URL.
    --help                               Shows this help message.`;
        case "doctor":
            return `EUDIPLO CLI

Usage:
    eudiplo doctor [--instance name]

Checks API reachability, health, authentication hints, public URLs, and client connectivity.

Options:
    --instance <name>                    Selects a configured instance.
    --help                               Shows this help message.`;
        case "status":
            return `EUDIPLO CLI

Usage:
    eudiplo status [--instance name]

Prints the selected instance URL and health status.

Options:
    --instance <name>                    Selects a configured instance.
    --help                               Shows this help message.`;
        case "config":
            return `EUDIPLO CLI

Usage:
    eudiplo config validate

Validates the local CLI configuration file.

Commands:
    eudiplo config validate              Validates configured instances and URLs.

Options:
    --help                               Shows this help message.`;
        case "version":
            return `EUDIPLO CLI

Usage:
    eudiplo version
    eudiplo --version
    eudiplo -v

Prints the installed CLI version. The version command also checks npm for updates.

Options:
    --help                               Shows this help message.`;
        default:
            return `Unknown command: ${command}\n\n${helpText()}`;
    }
}

function driverCommandDescription(command: "up" | "down" | "logs"): string {
    if (command === "up") {
        return "Starts the selected Docker Compose deployment.";
    }
    if (command === "down") {
        return "Stops the selected Docker Compose deployment.";
    }
    return "Streams logs for the selected Docker Compose deployment.";
}

function versionText(): string {
    return `${packageJson.name} ${packageJson.version}`;
}

async function versionStatusText(context: CommandContext): Promise<string> {
    const currentVersion = packageJson.version;
    const lines = [versionText()];

    try {
        const latestVersion = await fetchLatestVersion(context);
        lines.push(`latest ${latestVersion}`);
        const comparison = compareSemver(currentVersion, latestVersion);
        if (comparison < 0) {
            lines.push("update available: npm install -g @eudiplo/cli@latest");
        } else if (comparison === 0) {
            lines.push("up to date");
        } else {
            lines.push("newer than the latest published version");
        }
    } catch (error) {
        lines.push(`latest unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    return lines.join("\n");
}

async function fetchLatestVersion(context: CommandContext): Promise<string> {
    const response = await context.fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageJson.name)}/latest`,
    );
    if (!response.ok) {
        throw new Error(`npm registry returned HTTP ${response.status}`);
    }

    const metadata = await response.json();
    if (!isPackageMetadata(metadata)) {
        throw new Error("npm registry response did not include a version");
    }
    return metadata.version;
}

function isPackageMetadata(value: unknown): value is { version: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        "version" in value &&
        typeof value.version === "string"
    );
}

function compareSemver(left: string, right: string): number {
    const leftParts = parseSemver(left);
    const rightParts = parseSemver(right);

    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] > rightParts[index]) {
            return 1;
        }
        if (leftParts[index] < rightParts[index]) {
            return -1;
        }
    }

    return 0;
}

function parseSemver(version: string): [number, number, number] {
    const [major = "0", minor = "0", patch = "0"] = version.split("-", 1)[0].split(".");
    return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
}