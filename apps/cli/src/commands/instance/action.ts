import { readStringFlag } from "../../options.js";
import {
    removeInstance,
    saveConfig,
    setDefaultInstance,
    upsertInstance,
} from "../../services/cli-config.js";
import { parseTarget } from "../../services/deployment-target.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../types.js";

export async function runInstanceAdd(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
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

export function runInstanceList(config: CliConfig, context: CommandContext): number {
    const instances = Object.entries(config.instances).sort(([left], [right]) =>
        left.localeCompare(right),
    );
    if (instances.length === 0) {
        context.stdout.write("No configured instances.\n");
        return 0;
    }

    context.stdout.write("Configured instances:\n");
    for (const [name, instance] of instances) {
        const defaultLabel = name === config.defaultInstance ? " (default)" : "";
        context.stdout.write(
            `- ${name}${defaultLabel}: ${instance.target} ${instance.url}\n`,
        );
    }
    return 0;
}

export function runInstanceShow(
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): number {
    const name = parsed.positionals[0] ?? config.defaultInstance;
    if (!name) {
        throw new Error("No instance selected. Specify a name or add an instance first.");
    }
    const instance = config.instances[name];
    if (!instance) {
        throw new Error(`Unknown instance: ${name}`);
    }

    const defaultLabel = name === config.defaultInstance ? " (default)" : "";
    context.stdout.write(`Instance ${name}${defaultLabel}\n`);
    context.stdout.write(`Target: ${instance.target}\n`);
    context.stdout.write(`API URL: ${instance.url}\n`);
    writeOptionalValue(context, "Client URL", instance.clientUrl);
    writeOptionalValue(context, "Project directory", instance.projectDirectory);
    writeOptionalValue(context, "Compose file", instance.composeFile);
    writeOptionalList(context, "Compose files", instance.composeFiles);
    writeOptionalList(context, "Compose profiles", instance.composeProfiles);
    writeOptionalValue(context, "Environment file", instance.envFile);
    writeOptionalValue(context, "Project name", instance.projectName);
    return 0;
}

export async function runInstanceUse(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const name = requireInstanceName(parsed);
    await saveConfig(configPath, setDefaultInstance(config, name));
    context.stdout.write(`Default instance set to ${name}.\n`);
    return 0;
}

export async function runInstanceRemove(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const name = requireInstanceName(parsed);
    await saveConfig(configPath, removeInstance(config, name));
    context.stdout.write(`Unregistered instance ${name}.\n`);
    context.stdout.write("Deployment resources were not removed.\n");
    return 0;
}

function requireInstanceName(parsed: ParsedArgs): string {
    const name = parsed.positionals[0];
    if (!name) {
        throw new Error("Instance name is required.");
    }
    return name;
}

function writeOptionalValue(
    context: CommandContext,
    label: string,
    value: string | undefined,
): void {
    if (value !== undefined) {
        context.stdout.write(`${label}: ${value}\n`);
    }
}

function writeOptionalList(
    context: CommandContext,
    label: string,
    value: string[] | undefined,
): void {
    if (value !== undefined) {
        context.stdout.write(`${label}: ${value.join(", ")}\n`);
    }
}
