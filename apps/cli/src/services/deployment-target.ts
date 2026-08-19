import type { DeploymentTarget } from "../types.js";

export function parseTarget(value: string): DeploymentTarget {
    if (value === "compose" || value === "external") {
        return value;
    }
    throw new Error(`Unsupported target: ${value}`);
}
