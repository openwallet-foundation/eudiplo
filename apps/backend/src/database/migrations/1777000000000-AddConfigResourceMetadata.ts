import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class AddConfigResourceMetadata1777000000000
    implements MigrationInterface
{
    name = "AddConfigResourceMetadata1777000000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable("config_resource_metadata")) return;
        const isPostgres = queryRunner.connection.options.type === "postgres";
        await queryRunner.createTable(
            new Table({
                name: "config_resource_metadata",
                columns: [
                    { name: "tenantId", type: "varchar", isPrimary: true },
                    { name: "kind", type: "varchar", isPrimary: true },
                    { name: "resourceId", type: "varchar", isPrimary: true },
                    {
                        name: "ownership",
                        type: "varchar",
                        default: "'unmanaged'",
                    },
                    { name: "generation", type: "int", default: 1 },
                    { name: "source", type: "varchar", isNullable: true },
                    { name: "sourceHash", type: "varchar", isNullable: true },
                    {
                        name: "lastAppliedAt",
                        type: isPostgres
                            ? "timestamp with time zone"
                            : "datetime",
                        isNullable: true,
                    },
                    {
                        name: "createdAt",
                        type: isPostgres
                            ? "timestamp with time zone"
                            : "datetime",
                        default: isPostgres ? "now()" : "(datetime('now'))",
                    },
                    {
                        name: "updatedAt",
                        type: isPostgres
                            ? "timestamp with time zone"
                            : "datetime",
                        default: isPostgres ? "now()" : "(datetime('now'))",
                    },
                ],
            }),
            true,
        );
        await queryRunner.createIndex(
            "config_resource_metadata",
            new TableIndex({
                name: "IDX_config_resource_metadata_tenant_ownership",
                columnNames: ["tenantId", "ownership"],
            }),
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable("config_resource_metadata")) {
            await queryRunner.dropTable("config_resource_metadata");
        }
    }
}
