import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runDriverCommand } from "./action.js";

type DriverCommand = "up" | "down" | "logs";

const descriptions: Record<DriverCommand, string> = {
    up: "Start the selected Compose deployment",
    down: "Stop the selected Compose deployment",
    logs: "Stream logs for the selected Compose deployment",
};

export function createDeploymentCommands(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command[] {
    return (["up", "down", "logs"] as const).map((name) =>
        new Command(name)
            .description(descriptions[name])
            .argument(
                "[args...]",
                "additional arguments passed to the Compose runtime",
            )
            .option("--instance <name>", "select a configured Compose instance")
            .action(async (args, options) => {
                const { config } = await loadCliState(context);
                setExitCode(
                    await runDriverCommand(
                        config,
                        name,
                        parsedArgs(name, undefined, args, options),
                        context,
                    ),
                );
            }),
    );
}
