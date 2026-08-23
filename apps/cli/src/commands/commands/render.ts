import type { Command } from "commander";

export type CommandReferenceFormat = "text" | "markdown";

export function renderCommandReference(
    program: Command,
    format: CommandReferenceFormat,
): string {
    return format === "markdown"
        ? renderMarkdownReference(program)
        : renderTextReference(program);
}

function renderTextReference(program: Command): string {
    const commands = collectCommands(program).slice(1);
    const rows = commands.map((command) => ({
        invocation: usageLine(command),
        description: command.description(),
    }));
    const invocationWidth = Math.max(
        ...rows.map((row) => row.invocation.length),
    );
    const lines = rows.map((row) =>
        `  ${row.invocation.padEnd(invocationWidth)}  ${row.description}`.trimEnd(),
    );
    return `Available commands:\n\n${lines.join("\n")}\n`;
}

function renderMarkdownReference(program: Command): string {
    const sections = collectCommands(program).map((command, index) => {
        const heading =
            index === 0
                ? "# EUDIPLO CLI command reference"
                : `## \`${commandPath(command)}\``;
        const description =
            index === 0
                ? "Generated from the CLI command definitions. Do not edit this page manually."
                : command.description();
        return `${heading}\n\n${description}\n\n\`\`\`text\n${command.helpInformation().trim()}\n\`\`\``;
    });
    return `${sections.join("\n\n")}\n`;
}

function collectCommands(program: Command): Command[] {
    const commands: Command[] = [program];
    for (const child of program.commands) {
        if (
            child.name() === "help" ||
            (child as Command & { _hidden?: boolean })._hidden === true
        ) {
            continue;
        }
        commands.push(...collectCommands(child));
    }
    return commands;
}

function usageLine(command: Command): string {
    const firstLine = command.helpInformation().split("\n", 1)[0];
    return firstLine.replace(/^Usage:\s*/, "");
}

function commandPath(command: Command): string {
    const names: string[] = [];
    let current: Command | null = command;
    while (current) {
        names.unshift(current.name());
        current = current.parent;
    }
    return names.join(" ");
}
