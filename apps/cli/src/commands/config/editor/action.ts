import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
    applyEdits,
    modify,
    type ParseError,
    parse,
    printParseErrorCode,
} from "jsonc-parser";
import { readStringFlag } from "../../../options.js";
import type { CommandContext, ParsedArgs } from "../../../types.js";
import { TENANT_RESOURCE_REGISTRY } from "../validate/registry.js";
import { loadBundledConfigSchemaTexts } from "../validate/schemas.js";

const vscodeDirectoryName = ".vscode";
const managedSchemaDirectoryName = "eudiplo-schemas";
const managedSchemaUrlPrefix = `./${vscodeDirectoryName}/${managedSchemaDirectoryName}/`;

type JsonSchemaAssociation = {
    fileMatch: string[];
    url: string;
};

export async function setupVSCodeSchemaSupport(
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    if (parsed.positionals.length > 1) {
        throw new Error(`Unexpected argument: ${parsed.positionals[1]}`);
    }

    const workspacePath = resolve(context.cwd, parsed.positionals[0] ?? ".");
    const configDirectoryFlag =
        readStringFlag(parsed.flags, "config-directory") ?? "config";
    const configPath = isAbsolute(configDirectoryFlag)
        ? resolve(configDirectoryFlag)
        : resolve(workspacePath, configDirectoryFlag);
    const configRelativePath = relative(workspacePath, configPath);
    if (isOutsideWorkspace(configRelativePath)) {
        throw new Error(
            `Config directory must be inside the VS Code workspace: ${configPath}`,
        );
    }

    const vscodePath = join(workspacePath, vscodeDirectoryName);
    const schemaDirectory = join(vscodePath, managedSchemaDirectoryName);
    const settingsPath = join(vscodePath, "settings.json");
    await mkdir(schemaDirectory, { recursive: true });

    const schemaTexts = await loadBundledConfigSchemaTexts();
    for (const [schemaFile, contents] of schemaTexts) {
        await writeFile(join(schemaDirectory, schemaFile), contents, "utf8");
    }

    const associations = createSchemaAssociations(configRelativePath);
    const settingsText = await readSettings(settingsPath);
    const updatedSettings = mergeSchemaAssociations(
        settingsText,
        associations,
        settingsPath,
    );
    await writeFile(settingsPath, updatedSettings, "utf8");

    context.stdout.write(
        `Configured VS Code JSON Schema support in ${settingsPath}.\n`,
    );
    context.stdout.write(
        `Installed ${schemaTexts.size} schemas in ${schemaDirectory}.\n`,
    );
    context.stdout.write(
        `Associated ${associations.length} config resource patterns under ${configPath}.\n`,
    );
    return 0;
}

function createSchemaAssociations(
    configRelativePath: string,
): JsonSchemaAssociation[] {
    const normalizedConfigPath = configRelativePath
        .split(sep)
        .join("/")
        .replace(/^\/+|\/+$/g, "");
    const workspacePrefix = normalizedConfigPath
        ? `/${normalizedConfigPath}`
        : "";

    return TENANT_RESOURCE_REGISTRY.map((entry) => ({
        fileMatch: Array.from(
            new Set(
                entry.fileMatch
                    .filter((pattern) => pattern.startsWith("/assets/config/"))
                    .map(
                        (pattern) =>
                            `${workspacePrefix}${pattern.slice("/assets/config".length)}`,
                    ),
            ),
        ),
        url: `${managedSchemaUrlPrefix}${entry.schemaFile}`,
    })).filter((entry) => entry.fileMatch.length > 0);
}

async function readSettings(settingsPath: string): Promise<string> {
    try {
        return await readFile(settingsPath, "utf8");
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return "{}\n";
        }
        throw error;
    }
}

function mergeSchemaAssociations(
    settingsText: string,
    managedAssociations: JsonSchemaAssociation[],
    settingsPath: string,
): string {
    const errors: ParseError[] = [];
    const settings = parse(settingsText, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    }) as unknown;
    if (errors.length > 0) {
        const first = errors[0];
        throw new Error(
            `Cannot update ${settingsPath}: ${printParseErrorCode(first.error)} at offset ${first.offset}.`,
        );
    }
    if (!isRecord(settings)) {
        throw new Error(
            `Cannot update ${settingsPath}: the settings root must be an object.`,
        );
    }

    const existingValue = settings["json.schemas"];
    if (existingValue !== undefined && !Array.isArray(existingValue)) {
        throw new Error(
            `Cannot update ${settingsPath}: "json.schemas" must be an array.`,
        );
    }
    const unmanagedAssociations = (existingValue ?? []).filter(
        (entry) =>
            !isRecord(entry) ||
            typeof entry.url !== "string" ||
            !entry.url.startsWith(managedSchemaUrlPrefix),
    );
    const mergedAssociations = [
        ...unmanagedAssociations,
        ...managedAssociations,
    ];
    const eol = settingsText.includes("\r\n") ? "\r\n" : "\n";
    const edits = modify(settingsText, ["json.schemas"], mergedAssociations, {
        formattingOptions: {
            insertSpaces: true,
            tabSize: 2,
            eol,
        },
    });
    const updated = applyEdits(settingsText, edits);
    return updated.endsWith(eol) ? updated : `${updated}${eol}`;
}

function isOutsideWorkspace(relativePath: string): boolean {
    return (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}
