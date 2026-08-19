import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runInstanceAdd } from "./action.js";

export function createInstanceCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const instance = new Command("instance")
        .description("Manage configured EUDIPLO instances")
        .helpCommand(true);
    instance
        .command("add <name>")
        .description("Register an existing EUDIPLO deployment")
        .requiredOption("--url <url>", "EUDIPLO API URL")
        .option("--target <compose|external>", "deployment target", "external")
        .option("--client-url <url>", "optional web client URL")
        .action(async (name, options) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(
                await runInstanceAdd(
                    configPath,
                    config,
                    parsedArgs("instance", "add", [name], options),
                    context,
                ),
            );
        });
    instance.action(function showInstanceHelp() {
        this.outputHelp();
    });
    return instance;
}
