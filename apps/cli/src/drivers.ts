import { access, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
    createComposeFile,
    createComposeEnv,
    createNoClientComposeOverride,
    defaultComposeFileName,
    defaultComposeOverrideFileName,
    defaultEnvFileName,
} from "./compose-template.js";
import type {
    DeploymentDriver,
    DeploymentTarget,
    DriverCommandOptions,
    InstanceConfig,
} from "./types.js";

export const drivers: Record<DeploymentTarget, DeploymentDriver> = {
    compose: {
        target: "compose",
        async diagnostics(instance, context) {
            const messages: string[] = [];
            if (!(await resolveDockerExecutable())) {
                messages.push("Docker was not found in a supported install location.");
            }
            for (const composeFile of getComposeFiles(instance)) {
                try {
                    await access(resolve(context.cwd, composeFile));
                } catch {
                    messages.push(`Compose file not found: ${composeFile}`);
                }
            }
            return messages;
        },
        up(options) {
            return runCompose(["up", "-d", ...options.args], options);
        },
        down(options) {
            return runCompose(["down", ...options.args], options);
        },
        logs(options) {
            return runCompose(["logs", "-f", ...options.args], options);
        },
    },
    external: {
        target: "external",
        async diagnostics() {
            return [];
        },
    },
};

export async function ensureComposeProject(
    cwd: string,
    options: { useDemoImage?: boolean; noClient?: boolean } = {},
): Promise<InstanceConfig> {
    const composePath = join(cwd, defaultComposeFileName);
    const overridePath = join(cwd, defaultComposeOverrideFileName);
    const envPath = join(cwd, defaultEnvFileName);

    if (!(await exists(composePath))) {
        await writeFile(composePath, await createComposeFile(), "utf8");
    }
    if (!(await exists(envPath))) {
        await writeFile(envPath, createComposeEnv(options.useDemoImage === true), {
            encoding: "utf8",
            mode: 0o600,
        });
    }

    if (options.noClient === true) {
        await writeFile(overridePath, createNoClientComposeOverride(), "utf8");
    } else {
        await removeIfExists(overridePath);
    }

    const composeFiles = [defaultComposeFileName];
    if (options.noClient === true) {
        composeFiles.push(defaultComposeOverrideFileName);
    }

    return {
        target: "compose",
        url: "http://localhost:3000",
        clientUrl: options.noClient === true ? undefined : "http://localhost:4200",
        composeFile: defaultComposeFileName,
        composeFiles,
        envFile: defaultEnvFileName,
        projectName: "eudiplo-demo",
    };
}

export function unsupportedCommand(command: string, target: DeploymentTarget): string {
    if (target === "external") {
        return `${command} is not available for externally managed deployments`;
    }
    return `${command} is not available for ${target} deployments`;
}

async function runCompose(
    args: string[],
    { instance, context }: DriverCommandOptions,
): Promise<number> {
    const composeArgs = ["compose"];
    if (instance.envFile) {
        composeArgs.push("--env-file", resolve(context.cwd, instance.envFile));
    }
    for (const composeFile of getComposeFiles(instance)) {
        composeArgs.push("-f", resolve(context.cwd, composeFile));
    }
    if (instance.projectName) {
        composeArgs.push("--project-name", instance.projectName);
    }
    composeArgs.push(...args);

    const dockerExecutable = await resolveDockerExecutable();
    if (!dockerExecutable) {
        context.stderr.write("Docker was not found in a supported install location.\n");
        return 1;
    }

    return new Promise((resolveProcess) => {
        const child = spawn(dockerExecutable, composeArgs, {
            cwd: context.cwd,
            env: context.env,
            stdio: "inherit",
        });

        child.on("error", (error) => {
            context.stderr.write(`${error.message}\n`);
            resolveProcess(1);
        });
        child.on("close", (code) => resolveProcess(code ?? 1));
    });
}

async function resolveDockerExecutable(): Promise<string | undefined> {
    const executablePaths =
        process.platform === "win32"
            ? [String.raw`C:\Program Files\Docker\Docker\resources\bin\docker.exe`]
            : ["/usr/local/bin/docker", "/opt/homebrew/bin/docker", "/usr/bin/docker"];

    for (const executablePath of executablePaths) {
        if (await exists(executablePath)) {
            return executablePath;
        }
    }

    return undefined;
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function getComposeFiles(instance: InstanceConfig): string[] {
    return instance.composeFiles ?? (instance.composeFile ? [instance.composeFile] : []);
}

async function removeIfExists(path: string): Promise<void> {
    try {
        await unlink(path);
    } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
            throw error;
        }
    }
}