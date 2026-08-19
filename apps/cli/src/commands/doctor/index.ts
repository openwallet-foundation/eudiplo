import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runDoctorCommand } from "./action.js";

export function createDoctorCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("doctor")
        .description("Run deployment diagnostics")
        .option("--instance <name>", "select a configured instance")
        .action(async (options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await runDoctorCommand(
                    config,
                    parsedArgs("doctor", undefined, [], options),
                    context,
                ),
            );
        });
}
