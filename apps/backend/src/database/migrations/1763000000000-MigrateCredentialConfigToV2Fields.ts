import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";
import {
    type CredentialConfigV1,
    convertV1ToV2,
    deriveRuntimeArtifacts,
} from "../../issuer/configuration/credentials/utils";

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
