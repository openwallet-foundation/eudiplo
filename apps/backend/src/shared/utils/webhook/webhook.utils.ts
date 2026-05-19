/**
 * Extracts the raw cryptographic token from the presentation payload.
 * Supporting Multi-Credential-Flows by evaluating the descriptor_map or falling back to ID-mapping.
 */
export function extractRawTokenFromSubmission(
    id: string,
    payload:
        | { vp_token?: unknown; presentation_submission?: any }
        | null
        | undefined,
): string | undefined {
    const vpToken = payload?.vp_token;
    if (!vpToken) return undefined;

    // 1. PRIMARY STRATEGY: Use the descriptor_map
    const descriptor = payload?.presentation_submission?.descriptor_map?.find(
        (d: any) => d.id === id,
    );

    if (descriptor && Array.isArray(vpToken)) {
        const path = descriptor.path as string;

        // Path is "$" or "$[0]" -> First element
        if (path === "$" || path === "$[0]") {
            return typeof vpToken[0] === "string" ? vpToken[0] : undefined;
        }

        // Path is an index like "$[1]" (Crucial for Multi-Credential-Flows!)
        const indexMatch = path.match(/^\$\[(\d+)\]$/);
        if (indexMatch) {
            const index = Number.parseInt(indexMatch[1], 10);
            return typeof vpToken[index] === "string"
                ? vpToken[index]
                : undefined;
        }
    }

    // 2. FALLBACK STRATEGY: ID-Mapping
    if (
        typeof vpToken === "object" &&
        vpToken !== null &&
        !Array.isArray(vpToken)
    ) {
        const mapping = vpToken as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(mapping, id)) {
            const tokenForId = mapping[id];
            if (Array.isArray(tokenForId))
                return typeof tokenForId[0] === "string"
                    ? tokenForId[0]
                    : undefined;
            if (typeof tokenForId === "string") return tokenForId;
        }
    }

    // 3. LAST RESORT: Simple String (Single credential flow)
    if (typeof vpToken === "string") {
        return vpToken;
    }

    return undefined;
}
