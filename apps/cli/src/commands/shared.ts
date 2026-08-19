import { createInterface } from "node:readline/promises";
import type { OptionValues } from "commander";
import { loadConfig, resolveConfigPath } from "../services/cli-config.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../types.js";

export type SetExitCode = (exitCode: number) => void;

export interface Prompter {
    ask(question: string): Promise<string>;
    close(): void;
}

export function createPrompter(context: CommandContext): Prompter {
    let promptInterface: ReturnType<typeof createInterface> | undefined;

    return {
        ask: async (question: string) => {
            if (context.prompt) {
                return context.prompt(question);
            }
            promptInterface ??= createInterface({ input: process.stdin, output: process.stdout });
            return promptInterface.question(question);
        },
        close: () => promptInterface?.close(),
    };
}

export async function loadCliState(
    context: CommandContext,
): Promise<{ configPath: string; config: CliConfig }> {
    const configPath = resolveConfigPath(context.env);
    return { configPath, config: await loadConfig(configPath) };
}

export function parsedArgs(
    command: string,
    subject: string | undefined,
    positionals: string[],
    options: OptionValues,
): ParsedArgs {
    const flags: Record<string, string | boolean> = {};
    for (const [name, value] of Object.entries(options)) {
        if (value === undefined) {
            continue;
        }
        const flagName = name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
        if (value === false) {
            flags[`no-${flagName}`] = true;
        } else if (typeof value === "string" || typeof value === "boolean") {
            flags[flagName] = value;
        }
    }
    return { command, subject, positionals, flags };
}
