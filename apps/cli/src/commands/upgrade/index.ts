import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runUpgradeCommand } from "./action.js";

export function createUpgradeCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("upgrade")
        .description(
            "Upgrade the EUDIPLO application images of a Compose deployment",
        )
        .requiredOption("--image-tag <tag>", "image tag to upgrade to")
        .option("--instance <name>", "select a configured instance")
        .option("--yes", "upgrade without asking for confirmation")
        .action(async (options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await runUpgradeCommand(
                    config,
                    parsedArgs("upgrade", undefined, [], options),
                    context,
                ),
            );
        });
}
