import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { renderCommandReference } from "../apps/cli/src/commands/commands/render.js";
import { createProgram } from "../apps/cli/src/runtime.js";
import type { CommandContext } from "../apps/cli/src/types.js";

const outputPath = resolve("docs/getting-started/cli/command-reference.md");

async function main(): Promise<void> {
    const context = documentationContext();
    const program = createProgram(context, () => undefined);
    const markdown = renderCommandReference(program, "markdown");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, "utf8");
    console.log(`Generated ${outputPath}`);
}

function documentationContext(): CommandContext {
    return {
        cwd: process.cwd(),
        env: {},
        interactive: false,
        stdout: { write: () => true },
        stderr: { write: () => true },
        fetch,
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
