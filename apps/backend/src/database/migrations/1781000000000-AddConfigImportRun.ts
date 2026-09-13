import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";
export class AddConfigImportRun1781000000000 implements MigrationInterface {
    name = "AddConfigImportRun1781000000000";
    async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable("config_import_run")) return;
        const postgres = queryRunner.connection.options.type === "postgres";
        await queryRunner.createTable(
            new Table({
                name: "config_import_run",
                columns: [
                    { name: "id", type: "varchar", isPrimary: true },
                    { name: "tenantId", type: "varchar" },
                    { name: "mode", type: "varchar" },
                    {
                        name: "planFingerprint",
                        type: "varchar",
                        isNullable: true,
                    },
                    { name: "status", type: "varchar" },
                    {
                        name: "activeTenant",
                        type: "varchar",
                        isNullable: true,
                        isUnique: true,
                    },
                    { name: "operations", type: "json" },
                    { name: "revision", type: "int", default: 1 },
                    ...["createdAt", "updatedAt"].map((name) => ({
                        name,
                        type: postgres ? "timestamp" : "datetime",
                        default: postgres ? "now()" : "(datetime('now'))",
                    })),
                ],
            }),
            true,
        );
        await queryRunner.createIndex(
            "config_import_run",
            new TableIndex({
                name: "IDX_config_import_run_tenant_created",
                columnNames: ["tenantId", "createdAt"],
            }),
        );
    }
    async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable("config_import_run"))
            await queryRunner.dropTable("config_import_run");
    }
}
