import { Command, Option } from "commander";
import type { CommandContext } from "../../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../../shared.js";
import { runPortabilityCommand } from "./action.js";

export function createPortabilityCommands(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command[] {
    const remote = (name: "export" | "plan" | "import") => {
        const command = new Command(name)
            .description(
                name === "export"
                    ? "Export a tenant configuration bundle"
                    : `${name === "plan" ? "Plan" : "Apply"} a tenant configuration bundle`,
            )
            .option("--instance <name>", "select a configured instance")
            .option("--token <token>", "management API access token");
        if (name === "export") {
            command.option("--output <path>", "output bundle path");
        } else {
            command
                .argument("<bundle>")
                .addOption(
                    new Option("--mode <mode>", "import mode")
                        .choices(["create", "upsert", "replace"])
                        .default("upsert"),
                );
            if (name === "import") {
                command.option(
                    "--confirm-replace",
                    "confirm deletion semantics for replace mode",
                );
            }
        }
        command.action(async (...args: any[]) => {
            const options = args.at(-2) as Record<string, string | boolean>;
            const positionals = name === "export" ? [] : [String(args[0])];
            const { config } = await loadCliState(context);
            setExitCode(
                await runPortabilityCommand(
                    name,
                    config,
                    parsedArgs("config", name, positionals, options),
                    context,
                ),
            );
        });
        return command;
    };

    const upgrade = new Command("upgrade")
        .description("Upgrade a local configuration document or bundle")
        .argument("<file>")
        .option("--output <path>", "write upgraded JSON to this path")
        .option("--dry-run", "report migrations without writing output")
        .action(async (file, options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await runPortabilityCommand(
                    "upgrade",
                    config,
                    parsedArgs("config", "upgrade", [file], options),
                    context,
                ),
            );
        });
    return [remote("export"), remote("plan"), remote("import"), upgrade];
}
