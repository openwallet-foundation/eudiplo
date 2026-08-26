/**
 * Summarizes the flags for a given configuration key.
 * @param flags The flags object to summarize.
 * @returns A string representation of the flags.
 */
function summarizeFlags(flags?: any): string {
    if (!flags) return "";
    const bits: string[] = [];
    if (flags.presence === "required") bits.push("required");
    if ("default" in flags)
        bits.push(`default=${JSON.stringify(flags.default)}`);
    return bits.join(", ");
}

/**
 * Summarizes the shape of a given schema.
 * @param s The schema object to summarize.
 * @returns A string representation of the schema shape.
 */
function summarizeSchemaShape(s?: any): string {
    if (!s) return "";
    if (s.type === "boolean" && Array.isArray(s.allow) && s.allow.length)
        return String(s.allow[0]);
    if (Array.isArray(s.allow) && s.allow.length)
        return s.allow.map((v: any) => JSON.stringify(v)).join(" | ");
    if (s.type === "any") return "set"; // Joi.exist()
    return s.type ?? "condition";
}

/**
 * Summarizes the conditions for a given "when" entry.
 * @param w The "when" entry object to summarize.
 * @returns A string representation of the "when" entry.
 */
function summarizeWhenEntry(w: any): string {
    const ref =
        (typeof w.ref === "string" && w.ref) ||
        (Array.isArray(w.ref?.path) ? w.ref.path.join(".") : "ref");
    const isTxt = summarizeSchemaShape(w.is);
    const thenTxt = summarizeFlags(w.then?.flags);
    const othTxt = summarizeFlags(w.otherwise?.flags);
    const parts: string[] = [`when ${ref} is ${isTxt}`];
    if (thenTxt) parts.push(`then ${thenTxt}`);
    if (othTxt) parts.push(`otherwise ${othTxt}`);
    return parts.join(" → ");
}
/**
 * Extracts the conditions from a given key description.
 * @param keyDesc The key description object to extract conditions from.
 * @returns An array of strings representing the extracted conditions.
 */
export function extractConditionsFromKeyDesc(keyDesc: any): string[] {
    const out: string[] = [];
    if (Array.isArray(keyDesc?.whens))
        for (const w of keyDesc.whens) out.push(summarizeWhenEntry(w));
    if (Array.isArray(keyDesc?.matches)) {
        for (const m of keyDesc.matches) {
            if (m.ref || m.is || m.then || m.otherwise)
                out.push(summarizeWhenEntry(m));
        }
    }
    return out;
}
/**
 * Flattens the meta information from a given description object.
 * @param desc The description object to extract meta information from.
 * @returns A record containing the flattened meta information.
 */
export function flattenMetas(desc: any): Record<string, any> {
    const metas = Array.isArray(desc?.metas) ? desc.metas : [];
    return Object.assign({}, ...metas);
}