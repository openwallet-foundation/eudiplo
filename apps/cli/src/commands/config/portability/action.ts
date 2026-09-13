import { readFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join } from "node:path";
import { atomicWriteFile } from "@eudiplo/config-format/config-io.js";
import { upgradeFile } from "./upgrade.js";
import { readStringFlag } from "../../../options.js";
import { resolveInstance } from "../../../services/instance-selection.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../../types.js";

type Action =
    | "export"
    | "plan"
    | "import"
    | "upgrade"
    | "operations"
    | "recover";

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

    if (action === "operations" || action === "recover") {
        const id = parsed.positionals[0];
        if (
            action === "recover" &&
            (!id || parsed.flags["confirm-worker-stopped"] !== true)
        )
            throw new Error(
                "Recovery requires an operation ID and --confirm-worker-stopped after stopping the original worker",
            );
        const path = id ? `/${encodeURIComponent(id)}` : "";
        const response = await context.fetch(
            `${baseUrl}/api/config-bundles/operations${path}${action === "recover" ? "/acknowledge-interruption?confirmWorkerStopped=true" : ""}`,
            {
                method: action === "recover" ? "POST" : "GET",
                headers: authHeaders,
            },
        );
        await assertOk(response);
        context.stdout.write(
            `${JSON.stringify(await response.json(), null, 2)}\n`,
        );
        return 0;
    }
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
        await atomicWriteFile(output, data);
        context.stdout.write(`Exported configuration bundle to ${output}\n`);
        return 0;
    }

    const file = parsed.positionals[0];
    if (!file) throw new Error(`Usage: eudiplo config ${action} <bundle>`);
    const bundlePath = resolvePath(file, context);
    const archive = extname(bundlePath).toLowerCase() === ".zip";
    const mode = readStringFlag(parsed.flags, "mode") ?? "upsert";
    const query = new URLSearchParams({ mode });
    if (action === "import") {
        const planFile = readStringFlag(parsed.flags, "plan");
        const fingerprint = planFile
            ? JSON.parse(await readFile(resolvePath(planFile, context), "utf8"))
                  .planFingerprint
            : readStringFlag(parsed.flags, "plan-fingerprint");
        if (
            typeof fingerprint !== "string" ||
            !/^[a-f0-9]{64}$/.test(fingerprint)
        )
            throw new Error(
                "Import requires --plan <saved-plan.json> or --plan-fingerprint from a reviewed plan",
            );
        query.set("planFingerprint", fingerprint);
    }
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
    if (action === "plan") {
        const output = readStringFlag(parsed.flags, "output");
        if (output)
            await atomicWriteFile(
                resolvePath(output, context),
                `${JSON.stringify(result, null, 2)}\n`,
            );
    }
    if (action === "plan" && parsed.flags.diff === true) {
        for (const item of (result as any).items ?? []) {
            context.stdout.write(
                `${item.kind}/${item.id}: ${item.action}${item.action === "unchanged" && item.metadataChanged ? " (ownership update)" : ""}\n`,
            );
            for (const change of item.changes ?? [])
                context.stdout.write(
                    `  ${change.path}: ${JSON.stringify(change.before) ?? "(absent)"} -> ${JSON.stringify(change.after) ?? "(absent)"}\n`,
                );
            for (const issue of item.issues ?? [])
                context.stderr.write(
                    `${item.kind}/${item.id}${issue.path}: ${issue.message}\n`,
                );
        }
        for (const issue of (result as any).issues ?? []) {
            context.stderr.write(
                `${issue.code ?? "CONFIG_ISSUE"}${issue.path ?? ""}: ${issue.message}\n`,
            );
        }
        for (const asset of (result as any).assets ?? [])
            context.stdout.write(`${asset.path}: ${asset.action}\n`);
        context.stdout.write(
            `Plan fingerprint: ${(result as any).planFingerprint}\n`,
        );
        context.stdout.write(
            `Applicable: ${(result as any).applicable ? "yes" : "no"}\n`,
        );
    } else context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return (result as any).applicable === false ? 1 : 0;
}

function resolvePath(value: string, context: CommandContext): string {
    return isAbsolute(value) ? value : join(context.cwd, value);
}

async function assertOk(response: Response): Promise<void> {
    if (response.ok) return;
    const body = await response.text();
    throw new Error(`EUDIPLO API returned ${response.status}: ${body}`);
}
