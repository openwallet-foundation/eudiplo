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
import type { KubernetesScope } from "./kubectl.js";
import {
    buildCanIArgs,
    buildGetEndpointSlicesArgs,
    buildGetPodsArgs,
    buildGetWorkloadArgs,
    resolveScope,
    resolveWorkloads,
} from "./kubectl.js";
import type {
    CommandContext,
    DeploymentDriver,
    DeploymentTarget,
    DoctorCheck,
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
            const checks: DoctorCheck[] = [];
            const projectDirectory = instance.projectDirectory ?? context.cwd;
            const runtime = await resolveComposeRuntime(context.env);
            checks.push({
                name: "container runtime",
                status: runtime ? "pass" : "warn",
                message: runtime
                    ? `${runtime.name} found at ${runtime.command}`
                    : "Docker or Podman was not found in a supported install location.",
            });
            for (const composeFile of getComposeFiles(instance)) {
                let found = true;
                try {
                    await access(resolve(projectDirectory, composeFile));
                } catch {
                    found = false;
                }
                checks.push({
                    name: "compose file",
                    status: found ? "pass" : "warn",
                    message: found
                        ? `${composeFile} is present`
                        : `Compose file not found: ${composeFile}`,
                });
            }
            return checks;
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
    kubernetes: {
        target: "kubernetes",
        diagnostics: kubernetesDiagnostics,
    },
};

async function kubernetesDiagnostics(
    instance: InstanceConfig,
    context: CommandContext,
): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];

    const kubectl = await resolveKubectl(context.env);
    checks.push({
        name: "kubectl",
        status: kubectl ? "pass" : "fail",
        message: kubectl
            ? `kubectl found at ${kubectl}`
            : "kubectl was not found on PATH.",
    });
    if (!kubectl) {
        return checks;
    }

    let scope: KubernetesScope;
    try {
        scope = resolveScope(instance, "this instance");
    } catch (error) {
        checks.push({
            name: "cluster scope",
            status: "fail",
            message: error instanceof Error ? error.message : String(error),
        });
        return checks;
    }

    checks.push({
        name: "cluster scope",
        status: "pass",
        message: `context ${scope.context}, namespace ${scope.namespace}`,
    });

    // A namespace read is the cheapest way to prove the context resolves, the
    // namespace exists and the credentials still work, all in one call.
    const namespaceRead = await captureKubectl(
        kubectl,
        ["get", "namespace", scope.namespace, "--context", scope.context],
        context,
    );
    checks.push({
        name: "namespace",
        status: namespaceRead.code === 0 ? "pass" : "fail",
        message:
            namespaceRead.code === 0
                ? `${scope.namespace} is reachable`
                : `${scope.namespace} could not be read: ${firstLine(namespaceRead.stderr)}`,
    });
    if (namespaceRead.code !== 0) {
        return checks;
    }

    // Ask the API server what this user may do rather than waiting for a
    // command to fail, so a missing role reads as a permission problem
    // instead of an unexplained error later on.
    for (const [verb, resource] of requiredPermissions(instance)) {
        const permission = await captureKubectl(
            kubectl,
            buildCanIArgs(scope, verb, resource),
            context,
        );
        const allowed = permission.stdout.trim() === "yes";
        checks.push({
            name: "permissions",
            status: allowed ? "pass" : "fail",
            message: allowed
                ? `may ${verb} ${resource}`
                : `may not ${verb} ${resource} in namespace ${scope.namespace}. Grant it with a Role binding covering ${verb} on ${resource}.`,
        });
    }

    for (const workload of resolveWorkloads(instance, undefined)) {
        const read = await captureKubectl(
            kubectl,
            buildGetWorkloadArgs(scope, workload),
            context,
        );
        checks.push(workloadCheck(workload, read));
    }

    const pods = await captureKubectl(
        kubectl,
        buildGetPodsArgs(scope),
        context,
    );
    checks.push({
        name: "pods",
        status: pods.code === 0 ? "pass" : "warn",
        message:
            pods.code === 0
                ? `${countPodLines(pods.stdout)} pod(s) in ${scope.namespace}`
                : `pods could not be listed: ${firstLine(pods.stderr)}`,
    });

    const endpoints = await captureKubectl(
        kubectl,
        buildGetEndpointSlicesArgs(scope),
        context,
    );
    checks.push(endpointCheck(endpoints));

    return checks;
}

/**
 * Kubernetes removes an unready pod from its Service endpoints, so a
 * deployment running below its desired replica count still serves traffic
 * through the remaining pods. That is a warning rather than a failure: only a
 * deployment with nothing ready is actually down.
 */
function workloadCheck(workload: string, read: CapturedCommand): DoctorCheck {
    if (read.code !== 0) {
        return {
            name: "workload",
            status: "fail",
            message: `${workload} could not be read: ${firstLine(read.stderr)}`,
        };
    }

    let replicas: { ready: number; desired: number };
    try {
        replicas = readReplicaCounts(read.stdout);
    } catch {
        return {
            name: "workload",
            status: "warn",
            message: `${workload} exists, but its replica counts could not be read.`,
        };
    }

    const counts = `${replicas.ready}/${replicas.desired} replicas ready`;
    if (replicas.desired === 0) {
        return {
            name: "workload",
            status: "warn",
            message: `${workload} is scaled to zero.`,
        };
    }
    if (replicas.ready === 0) {
        return {
            name: "workload",
            status: "fail",
            message: `${workload} has no ready replicas (${counts}).`,
        };
    }
    return {
        name: "workload",
        status: replicas.ready < replicas.desired ? "warn" : "pass",
        message: `${workload}: ${counts}`,
    };
}

export function readReplicaCounts(stdout: string): {
    ready: number;
    desired: number;
} {
    const parsed: unknown = JSON.parse(stdout);
    if (!isRecord(parsed) || !isRecord(parsed.status)) {
        throw new Error("Unexpected workload payload.");
    }

    // `readyReplicas` is omitted entirely rather than set to zero when no pod
    // is ready, and `spec.replicas` defaults to 1 when unset.
    const ready = numberOr(parsed.status.readyReplicas, 0);
    const desired = isRecord(parsed.spec)
        ? numberOr(parsed.spec.replicas, 1)
        : numberOr(parsed.status.replicas, 1);
    return { ready, desired };
}

function numberOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback;
}

/**
 * A Service with no ready addresses is the usual shape of "the API answers on
 * localhost but not through the ingress", so it is worth calling out
 * separately from pod status.
 */
function endpointCheck(endpoints: CapturedCommand): DoctorCheck {
    if (endpoints.code !== 0) {
        return {
            name: "service endpoints",
            status: "warn",
            message: `endpoints could not be listed: ${firstLine(endpoints.stderr)}`,
        };
    }

    let unready: string[];
    try {
        unready = unreadyEndpoints(endpoints.stdout);
    } catch {
        return {
            name: "service endpoints",
            status: "warn",
            message: "endpoints could not be parsed.",
        };
    }

    return {
        name: "service endpoints",
        status: unready.length === 0 ? "pass" : "fail",
        message:
            unready.length === 0
                ? "all services have ready addresses"
                : `no ready addresses for: ${unready.join(", ")}`,
    };
}

/**
 * A Service may own several EndpointSlices (one per address family, and more
 * once it grows), so readiness is grouped by service name: a Service is ready
 * when any of its slices carries a ready endpoint.
 */
export function unreadyEndpoints(stdout: string): string[] {
    const parsed: unknown = JSON.parse(stdout);
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
        throw new Error("Unexpected endpointslice payload.");
    }

    const readyByService = new Map<string, boolean>();
    for (const item of parsed.items) {
        if (!isRecord(item) || !isRecord(item.metadata)) {
            continue;
        }
        const labels = isRecord(item.metadata.labels)
            ? item.metadata.labels
            : {};
        const service = String(
            labels["kubernetes.io/service-name"] ??
                item.metadata.name ??
                "unknown",
        );
        const endpoints = Array.isArray(item.endpoints) ? item.endpoints : [];
        const ready = endpoints.some(
            (endpoint) =>
                isRecord(endpoint) &&
                // An omitted ready condition means ready, per the API contract.
                (!isRecord(endpoint.conditions) ||
                    endpoint.conditions.ready !== false),
        );
        readyByService.set(service, (readyByService.get(service) ?? false) || ready);
    }

    return [...readyByService.entries()]
        .filter(([, ready]) => !ready)
        .map(([service]) => service)
        .sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredPermissions(
    instance: InstanceConfig,
): Array<[verb: string, resource: string]> {
    const permissions: Array<[string, string]> = [
        ["get", "pods"],
        ["get", "deployments"],
        ["get", "pods/log"],
    ];
    if (instance.readOnly !== true) {
        permissions.push(["patch", "deployments"]);
    }
    return permissions;
}

function countPodLines(stdout: string): number {
    const lines = stdout.trim().split("\n").filter(Boolean);
    return Math.max(lines.length - 1, 0);
}

function firstLine(value: string): string {
    return value.trim().split("\n")[0] ?? "no output";
}

async function resolveKubectl(
    env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
    const configured = env.EUDIPLO_KUBECTL;
    if (configured) {
        return (await exists(configured)) ? configured : undefined;
    }
    for (const candidate of executableCandidates("kubectl", env)) {
        if (await exists(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

interface CapturedCommand {
    code: number;
    stdout: string;
    stderr: string;
}

async function captureKubectl(
    kubectl: string,
    args: string[],
    context: CommandContext,
): Promise<CapturedCommand> {
    return new Promise((resolveProcess) => {
        const child = spawn(kubectl, args, {
            env: context.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk) => {
            stdout += String(chunk);
        });
        child.stderr?.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.on("error", (error) => {
            resolveProcess({ code: 1, stdout, stderr: error.message });
        });
        child.on("close", (code) =>
            resolveProcess({ code: code ?? 1, stdout, stderr }),
        );
    });
}

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
    const composeFileName =
        mode === "demo" ? demoComposeFileName : defaultComposeFileName;
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
        if (
            !hasExistingConfig ||
            options.force === true ||
            options.reset === true
        ) {
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
        clientUrl:
            options.noClient === true ? undefined : "http://localhost:4200",
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
    await rm(join(cwd, ".eudiplo/demo-config"), {
        recursive: true,
        force: true,
    });
}

export function unsupportedCommand(
    command: string,
    target: DeploymentTarget,
): string {
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
        composeArgs.push(
            "--env-file",
            resolve(projectDirectory, instance.envFile),
        );
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
        context.stderr.write(
            "Docker or Podman was not found in a supported install location.\n",
        );
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
    const preferredRuntime = parsePreferredRuntime(
        env.EUDIPLO_CONTAINER_RUNTIME,
    );
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

function parsePreferredRuntime(
    value: string | undefined,
): ContainerRuntimeName | undefined {
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
        return [
            String.raw`C:\Program Files\RedHat\Podman\podman.exe`,
            ...pathCandidates,
        ];
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
    return [
        join(pathEntry, runtime),
        ...extensions.map((ext) => join(pathEntry, `${runtime}${ext}`)),
    ];
}

/**
 * Generic PATH lookup, including the Windows PATHEXT extensions, for
 * executables that have no well-known install location.
 */
function executableCandidates(
    name: string,
    env: NodeJS.ProcessEnv,
): string[] {
    const pathEntries = (env.PATH ?? "").split(delimiter).filter(Boolean);
    if (process.platform !== "win32") {
        return pathEntries.map((entry) => join(entry, name));
    }
    const extensions = (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .filter(Boolean);
    return pathEntries.flatMap((entry) => [
        join(entry, name),
        ...extensions.map((ext) => join(entry, `${name}${ext}`)),
    ]);
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
    return (
        instance.composeFiles ??
        (instance.composeFile ? [instance.composeFile] : [])
    );
}

async function removeIfExists(path: string): Promise<void> {
    try {
        await unlink(path);
    } catch (error) {
        if (
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ENOENT"
        ) {
            throw error;
        }
    }
}
