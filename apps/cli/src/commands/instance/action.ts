import { readStringFlag } from "../../options.js";
import { saveConfig, upsertInstance } from "../../services/cli-config.js";
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
