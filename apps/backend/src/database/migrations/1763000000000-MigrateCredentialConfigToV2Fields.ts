import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";
import {
    buildClaims,
    buildClaimsByNamespace,
    buildClaimsMetadata,
    buildDisclosureFrame,
    buildJsonSchema,
} from "../../issuer/configuration/credentials/utils/derive";
import type { ClaimFieldDefinition } from "../../issuer/configuration/credentials/utils/types";

// ---------------------------------------------------------------------------
// V1 credential config types (historical — used only by this migration)
// ---------------------------------------------------------------------------

type CredentialFormat = "dc+sd-jwt" | "mso_mdoc";
type FieldType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "date";
type ClaimPathElement = string | number | null;

interface ClaimDisplayInfoV1 {
    name?: string;
    locale?: string;
}

interface ClaimMetadataV1 {
    path: ClaimPathElement[];
    mandatory?: boolean;
    display?: ClaimDisplayInfoV1[];
}

interface JsonSchemaV1 {
    $schema?: string;
    type?: string;
    title?: string;
    description?: string;
    properties?: Record<string, JsonSchemaV1>;
    required?: string[];
    items?: JsonSchemaV1;
    [key: string]: unknown;
}

interface CredentialConfigV1 extends Record<string, unknown> {
    config: {
        format: CredentialFormat;
        display?: Array<Record<string, unknown>>;
        scope?: string;
        docType?: string;
        namespace?: string;
        claimsByNamespace?: Record<string, Record<string, unknown>>;
        claimsMetadata?: ClaimMetadataV1[];
        keyAttestationsRequired?: Record<string, unknown>;
        [key: string]: unknown;
    };
    claims?: Record<string, unknown>;
    disclosureFrame?: Record<string, unknown>;
    schema?: JsonSchemaV1;
}

// ---------------------------------------------------------------------------
// V1 → V2 conversion helpers (self-contained copy, not imported from utils)
// ---------------------------------------------------------------------------

function pathKey(path: ClaimPathElement[]): string {
    return JSON.stringify(path);
}

function parsePathKey(key: string): ClaimPathElement[] {
    try {
        const parsed = JSON.parse(key);
        return Array.isArray(parsed) ? (parsed as ClaimPathElement[]) : [];
    } catch {
        return [];
    }
}

function segmentToKey(segment: ClaimPathElement): string {
    if (segment === null) return "*";
    return String(segment);
}

function inferTypeFromValue(value: unknown): FieldType {
    if (typeof value === "string") {
        return /^\d{4}-\d{2}-\d{2}$/.test(value) ? "date" : "string";
    }
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object" && value !== null) return "object";
    return "string";
}

function inferTypeFromSchema(schema?: JsonSchemaV1): FieldType | undefined {
    const t = schema?.type;
    if (t === "integer") return "integer";
    if (t === "number") return "number";
    if (t === "boolean") return "boolean";
    if (t === "array") return "array";
    if (t === "object") return "object";
    if (t === "string") return schema?.format === "date" ? "date" : "string";
    return undefined;
}

function getValueAtPath(
    target: Record<string, unknown> | undefined,
    path: ClaimPathElement[],
): unknown {
    if (!target) return undefined;
    let cursor: unknown = target;
    for (const segment of path) {
        if (cursor === null || cursor === undefined) return undefined;
        if (Array.isArray(cursor)) {
            const index = typeof segment === "number" ? segment : Number(segmentToKey(segment));
            if (!Number.isInteger(index) || index < 0) return undefined;
            cursor = cursor[index];
            continue;
        }
        if (typeof cursor !== "object") return undefined;
        cursor = (cursor as Record<string, unknown>)[segmentToKey(segment)];
    }
    return cursor;
}

function collectLeafPaths(value: unknown, prefix: ClaimPathElement[] = []): ClaimPathElement[][] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        if (value.length === 0) return [prefix];
        const nested: ClaimPathElement[][] = [];
        for (let i = 0; i < value.length; i += 1) {
            nested.push(...collectLeafPaths(value[i], [...prefix, i]));
        }
        return nested;
    }
    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) return [prefix];
        const nested: ClaimPathElement[][] = [];
        for (const [key, v] of entries) {
            nested.push(...collectLeafPaths(v, [...prefix, key]));
        }
        return nested;
    }
    return [prefix];
}

function collectDisclosurePaths(
    frame: unknown,
    prefix: ClaimPathElement[] = [],
    result: Set<string> = new Set(),
): Set<string> {
    if (!frame || typeof frame !== "object") return result;
    const record = frame as Record<string, unknown>;
    const sd = record._sd;
    if (Array.isArray(sd)) {
        for (const name of sd) {
            if (typeof name === "string") result.add(pathKey([...prefix, name]));
        }
    }
    for (const [key, nested] of Object.entries(record)) {
        if (key !== "_sd") collectDisclosurePaths(nested, [...prefix, key], result);
    }
    return result;
}

interface SchemaEntryV1 {
    schema: JsonSchemaV1;
    mandatory: boolean;
}

function collectSchemaLeafMap(
    schema: JsonSchemaV1 | undefined,
    prefix: ClaimPathElement[] = [],
    mandatory = false,
    result: Map<string, SchemaEntryV1> = new Map(),
): Map<string, SchemaEntryV1> {
    if (!schema || typeof schema !== "object") return result;
    const properties = schema.properties;
    if (properties && typeof properties === "object") {
        const required = new Set(Array.isArray(schema.required) ? schema.required : []);
        for (const [key, value] of Object.entries(properties)) {
            collectSchemaLeafMap(value, [...prefix, key], required.has(key), result);
        }
        return result;
    }
    if (prefix.length > 0) result.set(pathKey(prefix), { schema, mandatory });
    return result;
}

function collectMetadataByPath(metadata: ClaimMetadataV1[] | undefined): Map<string, ClaimMetadataV1> {
    const map = new Map<string, ClaimMetadataV1>();
    for (const entry of metadata ?? []) {
        if (Array.isArray(entry.path) && entry.path.length > 0) {
            map.set(pathKey(entry.path), entry);
        }
    }
    return map;
}

function normalizeDisplay(display: ClaimDisplayInfoV1[] | undefined): ClaimFieldDefinition["display"] {
    if (!display || display.length === 0) return undefined;
    return display
        .filter((entry) => !!entry.name)
        .map((entry) => ({ locale: entry.locale ?? "und", name: entry.name ?? "" }));
}

function collectPathsFromSchema(schema: JsonSchemaV1 | undefined): ClaimPathElement[][] {
    return Array.from(collectSchemaLeafMap(schema).keys()).map(parsePathKey);
}

function collectPaths(v1: CredentialConfigV1): { paths: ClaimPathElement[][]; namespaceByPath: Map<string, string> } {
    const keys = new Set<string>();
    const namespaceByPath = new Map<string, string>();
    for (const path of collectLeafPaths(v1.claims)) keys.add(pathKey(path));
    for (const entry of v1.config.claimsMetadata ?? []) {
        if (Array.isArray(entry.path) && entry.path.length > 0) keys.add(pathKey(entry.path));
    }
    for (const key of collectDisclosurePaths(v1.disclosureFrame)) keys.add(key);
    for (const path of collectPathsFromSchema(v1.schema)) keys.add(pathKey(path));
    for (const [namespace, claims] of Object.entries(v1.config.claimsByNamespace ?? {})) {
        for (const path of collectLeafPaths(claims)) {
            const fullPath = [namespace, ...path];
            const key = pathKey(fullPath);
            keys.add(key);
            namespaceByPath.set(key, namespace);
        }
    }
    return {
        paths: Array.from(keys).map(parsePathKey).sort((a, b) => pathKey(a).localeCompare(pathKey(b))),
        namespaceByPath,
    };
}

function extractConstraints(schema: JsonSchemaV1 | undefined): Record<string, unknown> | undefined {
    if (!schema) return undefined;
    const { type: _t, title: _ti, properties: _p, required: _r, $schema: _s, ...constraints } = schema;
    return Object.keys(constraints).length > 0 ? constraints : undefined;
}

function convertV1ToV2(v1: CredentialConfigV1): { config: Record<string, unknown>; fields: ClaimFieldDefinition[] } {
    const { paths, namespaceByPath } = collectPaths(v1);
    const metadataByPath = collectMetadataByPath(v1.config.claimsMetadata);
    const schemaByPath = collectSchemaLeafMap(v1.schema);
    const disclosureSet = collectDisclosurePaths(v1.disclosureFrame);
    const claimsByNamespace = v1.config.claimsByNamespace ?? {};
    const fields: ClaimFieldDefinition[] = [];

    for (const path of paths) {
        const key = pathKey(path);
        const metadata = metadataByPath.get(key);
        const schemaEntry = schemaByPath.get(key);

        let defaultValue = getValueAtPath(v1.claims, path);
        const namespace = namespaceByPath.get(key);
        if (defaultValue === undefined && namespace) {
            defaultValue = getValueAtPath(claimsByNamespace[namespace], path.slice(1));
        }

        const inferredType = inferTypeFromSchema(schemaEntry?.schema) ?? inferTypeFromValue(defaultValue);
        const field: ClaimFieldDefinition = { path, type: inferredType };

        if (defaultValue !== undefined) field.defaultValue = defaultValue;
        if (metadata?.mandatory === true || schemaEntry?.mandatory === true) field.mandatory = true;
        if (v1.config.format === "dc+sd-jwt") field.disclosable = disclosureSet.has(key);

        const display = normalizeDisplay(metadata?.display);
        if (display && display.length > 0) field.display = display;

        const constraints = extractConstraints(schemaEntry?.schema);
        if (constraints) field.constraints = constraints;

        if (namespace) {
            field.namespace = namespace;
        } else if (v1.config.format === "mso_mdoc" && v1.config.namespace) {
            field.namespace = v1.config.namespace;
        }

        fields.push(field);
    }

    const { claimsByNamespace: _cbn, claimsMetadata: _cm, namespace: _ns, ...restConfig } = v1.config;
    return {
        config: {
            ...restConfig,
            format: v1.config.format,
            display: v1.config.display ?? [],
            scope: v1.config.scope,
            docType: v1.config.docType,
            keyAttestationsRequired: v1.config.keyAttestationsRequired,
        },
        fields,
    };
}

function deriveRuntimeArtifacts(fields: ClaimFieldDefinition[]): {
    claims: Record<string, unknown>;
    disclosureFrame?: Record<string, unknown>;
    claimsMetadata: ReturnType<typeof buildClaimsMetadata>;
    schema: ReturnType<typeof buildJsonSchema>;
    claimsByNamespace: Record<string, Record<string, unknown>>;
} {
    return {
        claims: buildClaims(fields),
        disclosureFrame: buildDisclosureFrame(fields),
        claimsMetadata: buildClaimsMetadata(fields),
        schema: buildJsonSchema(fields),
        claimsByNamespace: buildClaimsByNamespace(fields),
    };
}

function parseMaybeJson(value: unknown): any {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }
    return value;
}

function toDbJson(value: unknown, isPostgres: boolean): unknown {
    if (value === undefined) {
        return null;
    }
    return isPostgres ? value : JSON.stringify(value);
}

export class MigrateCredentialConfigToV2Fields1763000000000
    implements MigrationInterface
{
    name = "MigrateCredentialConfigToV2Fields1763000000000";

    private async hasColumn(
        queryRunner: QueryRunner,
        tableName: string,
        columnName: string,
    ): Promise<boolean> {
        const table = await queryRunner.getTable(tableName);
        return !!table?.findColumnByName(columnName);
    }

    private quote(identifier: string): string {
        return `"${identifier}"`;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasCredentialConfig =
            await queryRunner.hasTable("credential_config");
        if (!hasCredentialConfig) {
            // Fresh databases may not include issuer tables yet depending on migration ordering.
            console.warn(
                "[Migration] credential_config table not found - skipping MigrateCredentialConfigToV2Fields1763000000000.",
            );
            return;
        }

        const isPostgres = queryRunner.connection.options.type === "postgres";

        const hasConfigVersion = await this.hasColumn(
            queryRunner,
            "credential_config",
            "configVersion",
        );
        if (!hasConfigVersion) {
            await queryRunner.addColumn(
                "credential_config",
                new TableColumn({
                    name: "configVersion",
                    type: isPostgres ? "integer" : "int",
                    default: "2",
                    isNullable: true,
                }),
            );
        }

        const hasFields = await this.hasColumn(
            queryRunner,
            "credential_config",
            "fields",
        );
        if (!hasFields) {
            await queryRunner.addColumn(
                "credential_config",
                new TableColumn({
                    name: "fields",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }

        const optionalColumns = [
            "description",
            "claims",
            "disclosureFrame",
            "schema",
            "vct",
            "keyBinding",
            "keyChainId",
            "statusManagement",
            "lifeTime",
            "iaeActions",
            "schemaMeta",
            "embeddedDisclosurePolicy",
            "attributeProviderId",
            "webhookEndpointId",
        ];

        const presentOptionalColumns: string[] = [];
        for (const column of optionalColumns) {
            if (
                await this.hasColumn(queryRunner, "credential_config", column)
            ) {
                presentOptionalColumns.push(column);
            }
        }

        const selectColumns = [
            this.quote("id"),
            this.quote("tenantId"),
            this.quote("config"),
            ...presentOptionalColumns.map((col) => this.quote(col)),
        ];

        const rows = (await queryRunner.query(
            `SELECT ${selectColumns.join(", ")} FROM credential_config`,
        )) as Array<Record<string, unknown>>;

        for (const row of rows) {
            const v1: CredentialConfigV1 = {
                id: row.id,
                description: row.description,
                config: (parseMaybeJson(row.config) ??
                    {}) as CredentialConfigV1["config"],
                claims: parseMaybeJson(row.claims),
                disclosureFrame: parseMaybeJson(row.disclosureFrame),
                schema: parseMaybeJson(row.schema),
                vct: parseMaybeJson(row.vct) ?? row.vct,
                keyBinding: row.keyBinding,
                keyChainId: row.keyChainId,
                statusManagement: row.statusManagement,
                lifeTime: row.lifeTime,
                iaeActions: parseMaybeJson(row.iaeActions),
                schemaMeta: parseMaybeJson(row.schemaMeta),
                embeddedDisclosurePolicy: parseMaybeJson(
                    row.embeddedDisclosurePolicy,
                ),
                attributeProviderId: row.attributeProviderId,
                webhookEndpointId: row.webhookEndpointId,
            } as CredentialConfigV1;

            const v2 = convertV1ToV2(v1);

            await queryRunner.manager
                .createQueryBuilder()
                .update("credential_config")
                .set({
                    configVersion: 2,
                    fields: toDbJson(v2.fields, isPostgres),
                    config: toDbJson(v2.config, isPostgres),
                })
                .where("id = :id AND tenantId = :tenantId", {
                    id: row.id,
                    tenantId: row.tenantId,
                })
                .execute();
        }

        if (await this.hasColumn(queryRunner, "credential_config", "claims")) {
            await queryRunner.dropColumn("credential_config", "claims");
        }
        if (
            await this.hasColumn(
                queryRunner,
                "credential_config",
                "disclosureFrame",
            )
        ) {
            await queryRunner.dropColumn(
                "credential_config",
                "disclosureFrame",
            );
        }
        if (await this.hasColumn(queryRunner, "credential_config", "schema")) {
            await queryRunner.dropColumn("credential_config", "schema");
        }

        await queryRunner.changeColumn(
            "credential_config",
            "configVersion",
            new TableColumn({
                name: "configVersion",
                type: isPostgres ? "integer" : "int",
                default: "2",
                isNullable: false,
            }),
        );

        await queryRunner.changeColumn(
            "credential_config",
            "fields",
            new TableColumn({
                name: "fields",
                type: isPostgres ? "jsonb" : "json",
                isNullable: false,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasCredentialConfig =
            await queryRunner.hasTable("credential_config");
        if (!hasCredentialConfig) {
            console.warn(
                "[Migration] credential_config table not found - skipping down for MigrateCredentialConfigToV2Fields1763000000000.",
            );
            return;
        }

        const isPostgres = queryRunner.connection.options.type === "postgres";

        if (
            !(await this.hasColumn(queryRunner, "credential_config", "claims"))
        ) {
            await queryRunner.addColumn(
                "credential_config",
                new TableColumn({
                    name: "claims",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }

        if (
            !(await this.hasColumn(
                queryRunner,
                "credential_config",
                "disclosureFrame",
            ))
        ) {
            await queryRunner.addColumn(
                "credential_config",
                new TableColumn({
                    name: "disclosureFrame",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }

        if (
            !(await this.hasColumn(queryRunner, "credential_config", "schema"))
        ) {
            await queryRunner.addColumn(
                "credential_config",
                new TableColumn({
                    name: "schema",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }

        const hasFieldsInDown = await this.hasColumn(
            queryRunner,
            "credential_config",
            "fields",
        );

        const rows = (await queryRunner.query(
            hasFieldsInDown
                ? `SELECT ${this.quote("id")}, ${this.quote("tenantId")}, ${this.quote("config")}, ${this.quote("fields")} FROM credential_config`
                : `SELECT ${this.quote("id")}, ${this.quote("tenantId")}, ${this.quote("config")} FROM credential_config`,
        )) as Array<Record<string, unknown>>;

        for (const row of rows) {
            const config = (parseMaybeJson(row.config) ?? {}) as Record<
                string,
                unknown
            >;
            const fields = parseMaybeJson(row.fields) as Array<unknown>;
            const runtime = deriveRuntimeArtifacts((fields ?? []) as any);

            const nextConfig: Record<string, unknown> = { ...config };

            if (runtime.claimsMetadata.length > 0) {
                nextConfig.claimsMetadata = runtime.claimsMetadata;
            }

            if (Object.keys(runtime.claimsByNamespace).length > 0) {
                nextConfig.claimsByNamespace = runtime.claimsByNamespace;

                if (
                    nextConfig.format === "mso_mdoc" &&
                    !nextConfig.namespace &&
                    Object.keys(runtime.claimsByNamespace).length === 1
                ) {
                    nextConfig.namespace = Object.keys(
                        runtime.claimsByNamespace,
                    )[0];
                }
            }

            await queryRunner.manager
                .createQueryBuilder()
                .update("credential_config")
                .set({
                    claims: toDbJson(runtime.claims, isPostgres),
                    disclosureFrame: toDbJson(
                        runtime.disclosureFrame,
                        isPostgres,
                    ),
                    schema: toDbJson(runtime.schema, isPostgres),
                    config: toDbJson(nextConfig, isPostgres),
                })
                .where("id = :id AND tenantId = :tenantId", {
                    id: row.id,
                    tenantId: row.tenantId,
                })
                .execute();
        }

        if (await this.hasColumn(queryRunner, "credential_config", "fields")) {
            await queryRunner.dropColumn("credential_config", "fields");
        }
        if (
            await this.hasColumn(
                queryRunner,
                "credential_config",
                "configVersion",
            )
        ) {
            await queryRunner.dropColumn("credential_config", "configVersion");
        }
    }
}
