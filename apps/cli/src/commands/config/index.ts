import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import type { SetExitCode } from "../shared.js";
import { createTenantCommand } from "./tenant/index.js";
import { createValidateCommand } from "./validate/index.js";

export function createConfigCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const config = new Command("config")
        .description("Validate and manage local configuration")
        .helpCommand(true);
    config.addCommand(createValidateCommand(context, setExitCode));
    config.addCommand(createTenantCommand(context, setExitCode));
    config.action(function showConfigHelp() {
        this.outputHelp();
    });
    return config;
}
