import type { CommandContext, InstanceConfig } from "../types.js";

type CheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
    name: string;
    status: CheckStatus;
    message: string;
}

export async function runDoctor(
    instance: InstanceConfig,
    context: CommandContext,
    driverDiagnostics: string[],
): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];
    const baseUrl = parseUrl(instance.url);

    if (!baseUrl) {
        return [
            {
                name: "public URL",
                status: "fail",
                message: `${instance.url} is not a valid absolute URL`,
            },
        ];
    }

    checks.push({
        name: "public URL",
        status: baseUrl.protocol === "https:" ? "pass" : "warn",
        message:
            baseUrl.protocol === "https:"
                ? `${baseUrl.href} uses HTTPS`
                : `${baseUrl.href} does not use HTTPS`,
    });

    checks.push(await checkEndpoint("API reachability", baseUrl, "/api/docs", context));
    checks.push(await checkEndpoint("health endpoint", baseUrl, "/health", context));
    checks.push(checkAuthentication(context));

    if (instance.clientUrl) {
        const clientUrl = parseUrl(instance.clientUrl);
        checks.push(
            clientUrl
                ? await checkEndpoint("client connectivity", clientUrl, "/", context)
                : {
                      name: "client connectivity",
                      status: "fail",
                      message: `${instance.clientUrl} is not a valid absolute URL`,
                  },
        );
    } else {
        checks.push({
            name: "client connectivity",
            status: "warn",
            message: "No client URL configured for this instance.",
        });
    }

    for (const diagnostic of driverDiagnostics) {
        checks.push({
            name: "driver diagnostics",
            status: "warn",
            message: diagnostic,
        });
    }

    return checks;
}

export function hasFailedChecks(checks: DoctorCheck[]): boolean {
    return checks.some((check) => check.status === "fail");
}

export function formatChecks(checks: DoctorCheck[]): string {
    return checks
        .map((check) => `${formatStatus(check.status)} ${check.name}: ${check.message}`)
        .join("\n");
}

async function checkEndpoint(
    name: string,
    baseUrl: URL,
    path: string,
    context: CommandContext,
): Promise<DoctorCheck> {
    const url = new URL(path, baseUrl);
    try {
        const response = await context.fetch(url, { method: "GET" });
        if (response.ok) {
            return {
                name,
                status: "pass",
                message: `${url.href} returned HTTP ${response.status}`,
            };
        }
        return {
            name,
            status: "fail",
            message: `${url.href} returned HTTP ${response.status}`,
        };
    } catch (error) {
        return {
            name,
            status: "fail",
            message: `${url.href} could not be reached: ${String(error)}`,
        };
    }
}

function checkAuthentication(context: CommandContext): DoctorCheck {
    const hasClientId = Boolean(context.env.EUDIPLO_CLIENT_ID);
    const hasClientSecret = Boolean(context.env.EUDIPLO_CLIENT_SECRET);
    if (hasClientId && hasClientSecret) {
        return {
            name: "authentication configuration",
            status: "pass",
            message: "Client credentials are available in environment variables.",
        };
    }

    return {
        name: "authentication configuration",
        status: "warn",
        message:
            "Set EUDIPLO_CLIENT_ID and EUDIPLO_CLIENT_SECRET when commands need authenticated API access.",
    };
}

function parseUrl(value: string): URL | undefined {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
    } catch {
        return undefined;
    }
}

function formatStatus(status: CheckStatus): string {
    if (status === "pass") {
        return "PASS";
    }
    if (status === "warn") {
        return "WARN";
    }
    return "FAIL";
}
