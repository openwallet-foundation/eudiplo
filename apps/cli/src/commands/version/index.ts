import { Command } from "commander";
import type { CommandContext } from "../../types.js";
import type { SetExitCode } from "../shared.js";
import { versionStatusText } from "./action.js";

export { versionText } from "./action.js";

export function createVersionCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("version")
        .description("Print the installed version and check for updates")
        .action(async () => {
            context.stdout.write(`${await versionStatusText(context)}\n`);
            setExitCode(0);
        });
}
