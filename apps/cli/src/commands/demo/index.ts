import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runDemo } from "./action.js";

export function createDemoCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("demo")
        .description("Start the minimal local demo")
        .argument("[directory]", "project directory")
        .option("--directory <path>", "set the project directory")
        .option("--reset", "recreate managed demo data and configuration")
        .option("--force", "allow replacement of managed demo files")
        .option("--yes", "accept the default directory without prompting")
        .option("--no-interactive", "disable the directory prompt")
        .option("--image-tag <tag>", "override the backend and client image tag")
        .action(async (directory, options) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(
                await runDemo(
                    configPath,
                    config,
                    parsedArgs("demo", directory, [], options),
                    context,
                ),
            );
        });
}
