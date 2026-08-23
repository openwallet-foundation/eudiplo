import { Command, Option } from "commander";
import type { CommandContext } from "../../types.js";
import {
    type CommandReferenceFormat,
    renderCommandReference,
} from "./render.js";

export function createCommandsCommand(
    context: CommandContext,
    getProgram: () => Command,
): Command {
    return new Command("commands")
        .description("List every available CLI command")
        .addOption(
            new Option("--format <text|markdown>", "output format")
                .choices(["text", "markdown"])
                .default("text"),
        )
        .action((options: { format: CommandReferenceFormat }) => {
            context.stdout.write(
                renderCommandReference(getProgram(), options.format),
            );
        });
}
