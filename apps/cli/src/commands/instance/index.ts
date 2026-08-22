import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import {
    runInstanceAdd,
    runInstanceList,
    runInstanceRemove,
    runInstanceShow,
    runInstanceUse,
} from "./action.js";

export function createInstanceCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const instance = new Command("instance")
        .description("Manage configured EUDIPLO instances")
        .helpCommand(true);
    instance
        .command("list")
        .alias("ls")
        .description("List configured EUDIPLO instances")
        .action(async () => {
            const { config } = await loadCliState(context);
            setExitCode(runInstanceList(config, context));
        });
    instance
        .command("show [name]")
        .description("Show configured instance details")
        .action(async (name) => {
            const { config } = await loadCliState(context);
            setExitCode(
                runInstanceShow(
                    config,
                    parsedArgs("instance", "show", name ? [name] : [], {}),
                    context,
                ),
            );
        });
    instance
        .command("use <name>")
        .description("Set the default EUDIPLO instance")
        .action(async (name) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(
                await runInstanceUse(
                    configPath,
                    config,
                    parsedArgs("instance", "use", [name], {}),
                    context,
                ),
            );
        });
    instance
        .command("remove <name>")
        .alias("rm")
        .description("Unregister an EUDIPLO instance")
        .action(async (name) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(
                await runInstanceRemove(
                    configPath,
                    config,
                    parsedArgs("instance", "remove", [name], {}),
                    context,
                ),
            );
        });
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
