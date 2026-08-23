import { resolve } from "node:path";
import { readStringFlag } from "../options.js";
import type { CommandContext, ParsedArgs } from "../types.js";

export function resolveProjectDirectory(
    parsed: ParsedArgs,
    context: CommandContext,
    promptedDirectory?: string,
): string {
    const positionalDirectory = parsed.subject;
    const flagDirectory = readStringFlag(parsed.flags, "directory");

    if (parsed.positionals.length > 0) {
        throw new Error(`Unexpected argument: ${parsed.positionals[0]}`);
    }
    if (positionalDirectory && flagDirectory) {
        throw new Error(
            "Specify the project directory either positionally or with --directory.",
        );
    }

    return resolve(
        context.cwd,
        positionalDirectory ?? flagDirectory ?? promptedDirectory ?? ".",
    );
}
