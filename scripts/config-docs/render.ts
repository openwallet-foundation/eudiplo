import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { ConfigGroup } from "./model";

function mdEscapePipes(s: string) {
  return s.replace(/\|/g, "\\|");
}

// These fragments are imported as MDX components, so curly braces must be
// escaped or they get parsed as JS expressions.
function mdxEscapeBraces(s: string) {
  return s.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function notesForItem(i: any): string {
  const presence = i.presence ? ` [${i.presence}]` : "";
  const def =
    i.defaultValue !== undefined
      ? ` (default: \`${String(i.defaultValue)}\`)`
      : "";
  const conds = (i.conditions ?? []).map((c: string) => `[${c}]`).join(" ");
  const extra = [
    i.meta?.deprecated ? `(deprecated: ${i.meta.deprecated})` : "",
    i.meta?.restartRequired ? "(restart required)" : "",
    i.meta?.docUrl ? `(docs: ${i.meta.docUrl})` : "",
    i.meta?.example ? `(e.g. ${i.meta.example})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [i.description, presence, def, conds, extra]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function renderGroupTable(g: ConfigGroup) {
  const lines: string[] = [];  
  lines.push(`| Key | Type | Notes |`);
  lines.push(`| --- | ---- | ----- |`);

  for (const i of g.items) {
    const notes = mdxEscapeBraces(mdEscapePipes(notesForItem(i)));
    const type = mdEscapePipes(String(i.type ?? ""));
    lines.push(`| \`${i.key}\` | \`${type}\` | ${notes} |`);
  }
  lines.push(""); // trailing newline
  return lines.join("\n");
}

const GENERATED_WARNING = [
  "> **Auto-generated.** Do not edit manually.",
  "> Run `pnpm --filter @eudiplo/docs run prebuild` (scripts/generate-config-docs.ts).",
  "",
].join("\n");

export function renderGroupPage(g: ConfigGroup) {
  const lines: string[] = [GENERATED_WARNING];
  lines.push(renderGroupTable(g));
  return lines.join("\n");
}

export async function writeFileSafely(filePath: string, content: string) {
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
