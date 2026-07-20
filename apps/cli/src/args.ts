import type { ParsedArgs } from "./types.js";

const shortFlagAliases: Record<string, string> = {
    h: "help",
    v: "version",
};

export function parseArgs(args: string[]): ParsedArgs {
    const flags: Record<string, string | boolean> = {};
    const positionals: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token.startsWith("-") && !token.startsWith("--")) {
            const alias = shortFlagAliases[token.slice(1)];
            if (alias) {
                flags[alias] = true;
                continue;
            }
        }
        if (!token.startsWith("--")) {
            positionals.push(token);
            continue;
        }

        const [rawName, rawValue] = token.slice(2).split("=", 2);
        if (rawValue !== undefined) {
            flags[rawName] = rawValue;
            continue;
        }

        const next = args[index + 1];
        if (next && !next.startsWith("--")) {
            flags[rawName] = next;
            index += 1;
        } else {
            flags[rawName] = true;
        }
    }

    return {
        command: positionals[0],
        subject: positionals[1],
        positionals: positionals.slice(2),
        flags,
    };
}

export function readStringFlag(
    flags: Record<string, string | boolean>,
    name: string,
): string | undefined {
    const value = flags[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}