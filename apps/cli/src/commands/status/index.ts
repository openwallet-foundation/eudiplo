import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runStatusCommand } from "./action.js";

export function createStatusCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("status")
        .description("Print the selected instance status")
        .option("--instance <name>", "select a configured instance")
        .action(async (options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await runStatusCommand(
                    config,
                    parsedArgs("status", undefined, [], options),
                    context,
                ),
            );
        });
}
