import { Command } from "commander";
import type { CommandContext } from "../../../types.js";
import { parsedArgs, type SetExitCode } from "../../shared.js";
import { setupVSCodeSchemaSupport } from "./action.js";

export function createEditorCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const editor = new Command("editor")
        .description("Configure editor support for local configuration files")
        .helpCommand(true);

    editor
        .command("setup [workspace]")
        .description("Install bundled JSON Schemas and configure VS Code")
        .option(
            "--config-directory <path>",
            "tenant config root relative to the workspace",
            "config",
        )
        .action(async (workspace, options) => {
            setExitCode(
                await setupVSCodeSchemaSupport(
                    parsedArgs(
                        "config",
                        "editor-setup",
                        workspace ? [workspace] : [],
                        options,
                    ),
                    context,
                ),
            );
        });

    editor.action(function showEditorHelp() {
        this.outputHelp();
    });
    return editor;
}
