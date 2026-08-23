import { readStringFlag } from "../../options.js";
import { saveConfig, upsertInstance } from "../../services/cli-config.js";
import {
    demoProjectExists,
    drivers,
    ensureComposeProject,
} from "../../services/deployment-drivers.js";
import { resolveProjectDirectory } from "../../services/project-directory.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../types.js";
import { createPrompter } from "../shared.js";

export async function runDemo(
    configPath: string,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const prompter = createPrompter(context);
    let projectDirectory: string;
    try {
        const shouldPrompt =
            context.interactive === true &&
            parsed.flags.yes !== true &&
            parsed.flags["no-interactive"] !== true &&
            !parsed.subject &&
            !readStringFlag(parsed.flags, "directory");
        const directoryAnswer = shouldPrompt
            ? await prompter.ask("Project directory [./]: ")
            : undefined;
        projectDirectory = resolveProjectDirectory(
            parsed,
            context,
            directoryAnswer?.trim() || undefined,
        );
    } finally {
        prompter.close();
    }
    const force = parsed.flags.force === true;
    const reset = parsed.flags.reset === true;
    const imageTagOverride =
        readStringFlag(parsed.flags, "image-tag") ??
        context.env.EUDIPLO_IMAGE_TAG;

    if (reset && !force) {
        throw new Error(
            "demo --reset requires --force to remove managed demo data.",
        );
    }

    if (reset && (await demoProjectExists(projectDirectory))) {
        context.stdout.write(
            "Resetting demo deployment and removing managed demo volumes...\n",
        );
        await drivers.compose.down?.({
            instanceName: "local",
            instance: {
                target: "compose",
                url: "http://localhost:3000",
                clientUrl: "http://localhost:4200",
                composeFiles: ["eudiplo.demo.compose.yaml"],
                envFile: ".eudiplo.demo.env",
                projectName: "eudiplo-demo",
                projectDirectory,
            },
            args: ["--volumes", "--remove-orphans"],
            context,
        });
    }

    const instance = await ensureComposeProject(projectDirectory, {
        mode: "demo",
        force,
        reset,
        imageTagOverride,
    });
    const nextConfig = upsertInstance(config, "local", instance);
    await saveConfig(configPath, nextConfig);
    context.stdout.write("Starting EUDIPLO demo with the Compose runtime...\n");
    const exitCode =
        (await drivers.compose.up?.({
            instanceName: "local",
            instance,
            args: [],
            context,
        })) ?? 1;

    if (exitCode === 0) {
        context.stdout.write("\nDemo mode - not for production.\n");
        context.stdout.write("API URL: http://localhost:3000\n");
        context.stdout.write("Client URL: http://localhost:4200\n");
        context.stdout.write("Demo credentials:\n");
        context.stdout.write("  Client ID: root\n");
        context.stdout.write("  Client Secret: root\n");
        context.stdout.write(
            `Editable demo config: ${projectDirectory}/config/demo\n`,
        );
    }

    return exitCode;
}
