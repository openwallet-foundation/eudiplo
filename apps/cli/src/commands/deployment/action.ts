import { drivers, unsupportedCommand } from "../../services/deployment-drivers.js";
import { resolveInstance } from "../../services/instance-selection.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../types.js";

export async function runDriverCommand(
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
        const clientMode = instance.clientUrl ? "client enabled" : "client disabled";
        context.stdout.write(`${command} ${instanceName} (${clientMode})\n`);
    }
    return handler({ instanceName, instance, args: parsed.positionals, context });
}
