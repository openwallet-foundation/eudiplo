import { access, mkdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
    copyBundledDemoConfig,
    createComposeFile,
    createComposeEnv,
    createGlobalKmsConfig,
    createNoClientComposeOverride,
    configDirectoryName,
    demoComposeFileName,
    demoConfigDirectory,
    demoEnvFileName,
    defaultComposeFileName,
    defaultComposeOverrideFileName,
    defaultEnvFileName,
    hasFiles,
} from "./compose-project.js";
import type {
    DeploymentDriver,
    DeploymentTarget,
    DriverCommandOptions,
    InstanceConfig,
} from "../types.js";

type ContainerRuntimeName = "docker" | "podman";

interface ComposeRuntime {
    command: string;
    name: ContainerRuntimeName;
}

export const drivers: Record<DeploymentTarget, DeploymentDriver> = {
    compose: {
        target: "compose",
        async diagnostics(instance, context) {
            const messages: string[] = [];
            const projectDirectory = instance.projectDirectory ?? context.cwd;
            if (!(await resolveComposeRuntime(context.env))) {
                messages.push("Docker or Podman was not found in a supported install location.");
            }
            for (const composeFile of getComposeFiles(instance)) {
                try {
                    await access(resolve(projectDirectory, composeFile));
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
    options: {
        mode?: "standard" | "demo";
        database?: "sqlite" | "postgres";
        storage?: "local" | "s3";
        kms?: "db" | "vault";
        publicUrl?: string;
        authClientId?: string;
        authClientSecret?: string;
        demoTenant?: boolean;
        noClient?: boolean;
        force?: boolean;
        reset?: boolean;
        imageTagOverride?: string;
    },
): Promise<InstanceConfig> {
    await ensureProjectDirectory(cwd);
    const mode = options.mode ?? "standard";
    const composeFileName = mode === "demo" ? demoComposeFileName : defaultComposeFileName;
    const envFileName = mode === "demo" ? demoEnvFileName : defaultEnvFileName;

    const composePath = join(cwd, composeFileName);
    const overridePath = join(cwd, defaultComposeOverrideFileName);
    const envPath = join(cwd, envFileName);
    const configPath = join(cwd, configDirectoryName);
    const globalKmsPath = join(configPath, "kms.json");

    await mkdir(configPath, { recursive: true, mode: 0o700 });

    if (mode === "demo" && options.reset === true) {
        await removeDemoProjectAssets(cwd);
    }

    if (!(await exists(composePath)) || options.force === true) {
        await writeFile(composePath, await createComposeFile(), "utf8");
    }
    if (!(await exists(envPath)) || options.force === true) {
        await writeFile(
            envPath,
            createComposeEnv({
                mode,
                imageTagOverride: options.imageTagOverride,
                database: options.database,
                storage: options.storage,
                kms: options.kms,
                publicUrl: options.publicUrl,
                authClientId: options.authClientId,
                authClientSecret: options.authClientSecret,
            }),
            {
            encoding: "utf8",
            mode: 0o600,
            },
        );
    }

    if (!(await exists(globalKmsPath)) || options.force === true) {
        await writeFile(
            globalKmsPath,
            createGlobalKmsConfig(options.kms ?? "db"),
            { encoding: "utf8", mode: 0o600 },
        );
    }

    if (mode === "demo" || options.demoTenant === true) {
        const demoConfigPath = join(cwd, demoConfigDirectory);
        const hasExistingConfig = await hasFiles(demoConfigPath);
        if (!hasExistingConfig || options.force === true || options.reset === true) {
            await copyBundledDemoConfig(demoConfigPath, true);
        }
    }

    if (options.noClient === true) {
        await writeFile(overridePath, createNoClientComposeOverride(), "utf8");
    } else {
        await removeIfExists(overridePath);
    }

    const composeFiles = [composeFileName];
    if (options.noClient === true) {
        composeFiles.push(defaultComposeOverrideFileName);
    }

    return {
        target: "compose",
        url: "http://localhost:3000",
        clientUrl: options.noClient === true ? undefined : "http://localhost:4200",
        composeFile: defaultComposeFileName,
        composeFiles,
        composeProfiles: composeProfiles(options),
        envFile: envFileName,
        projectName: mode === "demo" ? "eudiplo-demo" : "eudiplo",
        projectDirectory: resolve(cwd),
    };
}

async function ensureProjectDirectory(directory: string): Promise<void> {
    try {
        const entry = await stat(directory);
        if (!entry.isDirectory()) {
            throw new Error(`Project directory points to a file: ${directory}`);
        }
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            await mkdir(directory, { recursive: true, mode: 0o700 });
            return;
        }
        throw error;
    }
}

function composeProfiles(options: {
    mode?: "standard" | "demo";
    database?: "sqlite" | "postgres";
    storage?: "local" | "s3";
    kms?: "db" | "vault";
}): string[] | undefined {
    if (options.mode === "demo") {
        return undefined;
    }

    const profiles: string[] = [];
    if (options.database === "postgres") {
        profiles.push("postgres");
    }
    if (options.storage === "s3") {
        profiles.push("s3");
    }
    if (options.kms === "vault") {
        profiles.push("vault");
    }
    return profiles.length > 0 ? profiles : undefined;
}

export async function demoProjectExists(cwd: string): Promise<boolean> {
    return (
        (await exists(join(cwd, demoComposeFileName))) ||
        (await exists(join(cwd, demoEnvFileName))) ||
        (await exists(join(cwd, demoConfigDirectory))) ||
        (await exists(join(cwd, ".eudiplo/demo-config")))
    );
}

async function removeDemoProjectAssets(cwd: string): Promise<void> {
    await rm(join(cwd, demoComposeFileName), { force: true });
    await rm(join(cwd, demoEnvFileName), { force: true });
    await rm(join(cwd, defaultComposeOverrideFileName), { force: true });
    await rm(join(cwd, demoConfigDirectory), { recursive: true, force: true });
    await rm(join(cwd, ".eudiplo/demo-config"), { recursive: true, force: true });
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
    const projectDirectory = instance.projectDirectory ?? context.cwd;
    const composeArgs = ["compose"];
    if (instance.envFile) {
        composeArgs.push("--env-file", resolve(projectDirectory, instance.envFile));
    }
    for (const composeFile of getComposeFiles(instance)) {
        composeArgs.push("-f", resolve(projectDirectory, composeFile));
    }
    for (const profile of instance.composeProfiles ?? []) {
        composeArgs.push("--profile", profile);
    }
    if (instance.projectName) {
        composeArgs.push("--project-name", instance.projectName);
    }
    composeArgs.push(...args);

    const composeRuntime = await resolveComposeRuntime(context.env);
    if (!composeRuntime) {
        context.stderr.write("Docker or Podman was not found in a supported install location.\n");
        return 1;
    }

    return new Promise((resolveProcess) => {
        const child = spawn(composeRuntime.command, composeArgs, {
            cwd: projectDirectory,
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

export async function resolveComposeRuntime(
    env: NodeJS.ProcessEnv,
): Promise<ComposeRuntime | undefined> {
    const preferredRuntime = parsePreferredRuntime(env.EUDIPLO_CONTAINER_RUNTIME);
    const candidates = preferredRuntime
        ? [preferredRuntime]
        : (["docker", "podman"] as const);

    for (const runtime of candidates) {
        const command = await resolveRuntimeExecutable(runtime, env);
        if (command) {
            return { command, name: runtime };
        }
    }

    return undefined;
}

function parsePreferredRuntime(value: string | undefined): ContainerRuntimeName | undefined {
    if (!value) {
        return undefined;
    }
    if (value === "docker" || value === "podman") {
        return value;
    }
    throw new Error("EUDIPLO_CONTAINER_RUNTIME must be docker or podman.");
}

async function resolveRuntimeExecutable(
    runtime: ContainerRuntimeName,
    env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
    for (const executablePath of runtimeExecutablePaths(runtime, env)) {
        if (await exists(executablePath)) {
            return executablePath;
        }
    }

    return undefined;
}

function runtimeExecutablePaths(
    runtime: ContainerRuntimeName,
    env: NodeJS.ProcessEnv,
): string[] {
    const pathCandidates = (env.PATH ?? "")
        .split(delimiter)
        .filter(Boolean)
        .flatMap((pathEntry) => runtimePathCandidates(pathEntry, runtime, env));

    if (process.platform === "win32") {
        if (runtime === "docker") {
            return [
                String.raw`C:\Program Files\Docker\Docker\resources\bin\docker.exe`,
                ...pathCandidates,
            ];
        }
        return [String.raw`C:\Program Files\RedHat\Podman\podman.exe`, ...pathCandidates];
    }

    return [
        `/usr/local/bin/${runtime}`,
        `/opt/homebrew/bin/${runtime}`,
        `/usr/bin/${runtime}`,
        ...pathCandidates,
    ];
}

function runtimePathCandidates(
    pathEntry: string,
    runtime: ContainerRuntimeName,
    env: NodeJS.ProcessEnv,
): string[] {
    if (process.platform !== "win32") {
        return [join(pathEntry, runtime)];
    }

    const extensions = (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .filter(Boolean);
    return [join(pathEntry, runtime), ...extensions.map((ext) => join(pathEntry, `${runtime}${ext}`))];
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
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
