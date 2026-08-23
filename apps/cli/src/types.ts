export type DeploymentTarget = "compose" | "external";
type CliInstallationMethod = "npm" | "standalone";

export interface InstanceConfig {
    target: DeploymentTarget;
    url: string;
    clientUrl?: string;
    composeFile?: string;
    composeFiles?: string[];
    composeProfiles?: string[];
    envFile?: string;
    projectName?: string;
    projectDirectory?: string;
}

export interface CliConfig {
    defaultInstance?: string;
    instances: Record<string, InstanceConfig>;
}

export interface CommandContext {
    cwd: string;
    env: NodeJS.ProcessEnv;
    installationMethod?: CliInstallationMethod;
    interactive?: boolean;
    prompt?: (question: string) => Promise<string>;
    stdout: Pick<NodeJS.WriteStream, "write">;
    stderr: Pick<NodeJS.WriteStream, "write">;
    fetch: typeof fetch;
}

export interface DriverCommandOptions {
    instanceName: string;
    instance: InstanceConfig;
    args: string[];
    context: CommandContext;
}

export interface DeploymentDriver {
    target: DeploymentTarget;
    diagnostics(
        instance: InstanceConfig,
        context: CommandContext,
    ): Promise<string[]>;
    up?(options: DriverCommandOptions): Promise<number>;
    down?(options: DriverCommandOptions): Promise<number>;
    logs?(options: DriverCommandOptions): Promise<number>;
}

export interface ParsedArgs {
    command?: string;
    subject?: string;
    positionals: string[];
    flags: Record<string, string | boolean>;
}
