import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname, isAbsolute, join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readStringFlag } from "../../../options.js";
import { resolveInstance } from "../../../services/instance-selection.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../../types.js";
import { upgradeDocument, type PortableDocument } from "./migrations.js";

type Action = "export" | "plan" | "import" | "upgrade";

export async function runPortabilityCommand(
    action: Action,
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    if (action === "upgrade") return upgradeFile(parsed, context);
    const [, instance] = resolveInstance(config, parsed);
    const token =
        readStringFlag(parsed.flags, "token") ?? context.env.EUDIPLO_TOKEN;
    if (!token) {
        throw new Error(
            "An access token is required via --token or EUDIPLO_TOKEN.",
        );
    }
    const authHeaders = {
        authorization: `Bearer ${token}`,
    };
    const baseUrl = instance.url.replace(/\/$/, "");

    if (action === "export") {
        const output = resolvePath(
            readStringFlag(parsed.flags, "output") ??
                "eudiplo-config-bundle.zip",
            context,
        );
        const format =
            extname(output).toLowerCase() === ".json" ? "json" : "zip";
        const response = await context.fetch(
            `${baseUrl}/api/config-bundles/export?format=${format}`,
            { headers: authHeaders },
        );
        await assertOk(response);
        const data =
            format === "zip"
                ? Buffer.from(await response.arrayBuffer())
                : `${JSON.stringify(await response.json(), null, 2)}\n`;
        await writeFile(output, data, { mode: 0o600 });
        context.stdout.write(`Exported configuration bundle to ${output}\n`);
        return 0;
    }

    const file = parsed.positionals[0];
    if (!file) throw new Error(`Usage: eudiplo config ${action} <bundle>`);
    const bundlePath = resolvePath(file, context);
    const archive = extname(bundlePath).toLowerCase() === ".zip";
    const mode = readStringFlag(parsed.flags, "mode") ?? "upsert";
    const query = new URLSearchParams({ mode });
    if (parsed.flags["confirm-replace"] === true) {
        query.set("confirmReplace", "true");
    }
    let body: BodyInit;
    let headers: Record<string, string> = authHeaders;
    let endpoint: string = action;
    if (archive) {
        const form = new FormData();
        form.set(
            "bundle",
            new Blob([await readFile(bundlePath)], { type: "application/zip" }),
            basename(bundlePath),
        );
        body = form;
        endpoint = `${action}/archive`;
    } else {
        const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
        body = JSON.stringify(bundle);
        headers = { ...headers, "content-type": "application/json" };
    }
    const response = await context.fetch(
        `${baseUrl}/api/config-bundles/${endpoint}?${query}`,
        { method: "POST", headers, body },
    );
    await assertOk(response);
    const result = await response.json();
    context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return (result as any).applicable === false ? 1 : 0;
}

async function upgradeFile(
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const file = parsed.positionals[0];
    if (!file)
        throw new Error("Usage: eudiplo config upgrade <bundle-or-document>");
    const inputPath = resolvePath(file, context);
    if (extname(inputPath).toLowerCase() === ".zip") {
        return upgradeArchive(inputPath, file, parsed, context);
    }
    const input = JSON.parse(await readFile(inputPath, "utf8"));
    const results: Array<ReturnType<typeof upgradeDocument>> = Array.isArray(
        input.documents,
    )
        ? input.documents.map((document: PortableDocument) =>
              upgradeDocument(document),
          )
        : [upgradeDocument(input as PortableDocument)];
    const output = Array.isArray(input.documents)
        ? upgradeJsonBundle(input, results)
        : results[0].document;
    const report = results.flatMap((result) => result.issues);
    const outputPath = resolvePath(
        readStringFlag(parsed.flags, "output") ?? `${file}.upgraded.json`,
        context,
    );
    if (parsed.flags["dry-run"] !== true) {
        await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
            mode: 0o600,
        });
        context.stdout.write(`Wrote upgraded configuration to ${outputPath}\n`);
    }
    for (const result of results) {
        for (const migration of result.migrations) {
            context.stdout.write(`Applied ${migration}\n`);
        }
    }
    for (const issue of report) {
        context.stderr.write(
            `${issue.severity} ${issue.code} ${issue.path}: ${issue.message}\n`,
        );
    }
    return report.some((issue) => issue.severity !== "warning") ? 1 : 0;
}

function upgradeJsonBundle(
    input: any,
    results: Array<ReturnType<typeof upgradeDocument>>,
): any {
    const documents = results.map((result) => result.document);
    const resources = (input.manifest?.resources ?? []).map((resource: any) => {
        const document = documents.find(
            (candidate) =>
                candidate.kind === resource.kind &&
                candidate.metadata.id === resource.id,
        );
        if (!document) return resource;
        return {
            ...resource,
            apiVersion: document.apiVersion,
            sha256: createHash("sha256")
                .update(JSON.stringify(document))
                .digest("hex"),
        };
    });
    return {
        ...input,
        manifest: { ...input.manifest, resources },
        documents,
    };
}

async function upgradeArchive(
    inputPath: string,
    displayPath: string,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const entries = unzipSync(new Uint8Array(await readFile(inputPath)));
    const manifestBytes = entries["manifest.json"];
    if (!manifestBytes)
        throw new Error("Configuration ZIP has no manifest.json");
    const manifest = JSON.parse(strFromU8(manifestBytes));
    const reports: Array<ReturnType<typeof upgradeDocument>> = [];
    for (const resource of manifest.resources ?? []) {
        const bytes = entries[resource.path];
        if (!bytes)
            throw new Error(`Configuration ZIP is missing ${resource.path}`);
        const result = upgradeDocument(JSON.parse(strFromU8(bytes)));
        reports.push(result);
        const output = strToU8(JSON.stringify(result.document));
        entries[resource.path] = output;
        resource.apiVersion = result.document.apiVersion;
        resource.sha256 = createHash("sha256").update(output).digest("hex");
    }
    entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    const outputPath = resolvePath(
        readStringFlag(parsed.flags, "output") ?? `${displayPath}.upgraded.zip`,
        context,
    );
    if (parsed.flags["dry-run"] !== true) {
        await writeFile(
            outputPath,
            Buffer.from(zipSync(entries, { level: 6 })),
            {
                mode: 0o600,
            },
        );
        context.stdout.write(`Wrote upgraded configuration to ${outputPath}\n`);
    }
    for (const result of reports) {
        for (const migration of result.migrations) {
            context.stdout.write(`Applied ${migration}\n`);
        }
        for (const issue of result.issues) {
            context.stderr.write(
                `${issue.severity} ${issue.code} ${issue.path}: ${issue.message}\n`,
            );
        }
    }
    return reports.some((result) =>
        result.issues.some((issue) => issue.severity !== "warning"),
    )
        ? 1
        : 0;
}

function resolvePath(value: string, context: CommandContext): string {
    return isAbsolute(value) ? value : join(context.cwd, value);
}

async function assertOk(response: Response): Promise<void> {
    if (response.ok) return;
    const body = await response.text();
    throw new Error(`EUDIPLO API returned ${response.status}: ${body}`);
}
