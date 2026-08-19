export function readStringFlag(
    flags: Record<string, string | boolean>,
    name: string,
): string | undefined {
    const value = flags[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
