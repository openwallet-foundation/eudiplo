import { Command } from "commander";
import { runConfigPath, runConfigShow } from "./action.js";
import type { CommandContext } from "../../types.js";
import { loadCliState, type SetExitCode } from "../shared.js";
import { createTenantCommand } from "./tenant/index.js";
import { createValidateCommand } from "./validate/index.js";

export function createConfigCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const config = new Command("config")
        .description("Validate and manage local configuration")
        .helpCommand(true);
    config
        .command("path")
        .description("Print the active CLI config file path")
        .action(() => {
            setExitCode(runConfigPath(context));
        });
    config
        .command("show")
        .description("Show the validated CLI configuration")
        .option("--json", "print config as JSON")
        .action(async (options) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(runConfigShow(configPath, config, options.json === true, context));
        });
    config.addCommand(createValidateCommand(context, setExitCode));
    config.addCommand(createTenantCommand(context, setExitCode));
    config.action(function showConfigHelp() {
        this.outputHelp();
    });
    return config;
}
