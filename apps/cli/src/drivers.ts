import { access, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
    createComposeFile,
    createDemoEnv,
    defaultComposeFileName,
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
            if (instance.composeFile) {
                try {
                    await access(resolve(context.cwd, instance.composeFile));
                } catch {
                    messages.push(`Compose file not found: ${instance.composeFile}`);
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

export async function ensureComposeProject(cwd: string): Promise<InstanceConfig> {
    const composePath = join(cwd, defaultComposeFileName);
    const envPath = join(cwd, defaultEnvFileName);

    if (!(await exists(composePath))) {
        await writeFile(composePath, await createComposeFile(), "utf8");
    }
    if (!(await exists(envPath))) {
        await writeFile(envPath, createDemoEnv(), { encoding: "utf8", mode: 0o600 });
    }

    return {
        target: "compose",
        url: "http://localhost:3000",
        clientUrl: "http://localhost:4200",
        composeFile: defaultComposeFileName,
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
    if (instance.composeFile) {
        composeArgs.push("-f", resolve(context.cwd, instance.composeFile));
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