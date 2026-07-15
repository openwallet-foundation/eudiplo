import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adds a CWT cache column to status list rows.
 * CWT is stored as base64url text and regenerated together with JWT on refresh.
 */
export class AddCwtCacheToStatusList1771000000000
    implements MigrationInterface
{
    name = "AddCwtCacheToStatusList1771000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = await this.resolveStatusListTableName(queryRunner);
        if (!tableName) {
            console.log(
                "[Migration] status list table not found - skipping AddCwtCacheToStatusList.",
            );
            return;
        }

        const table = await queryRunner.getTable(tableName);
        if (!table) {
            return;
        }

        if (!table.columns.some((col) => col.name === "cwt")) {
            await queryRunner.addColumn(
                tableName,
                new TableColumn({
                    name: "cwt",
                    type: "text",
                    isNullable: true,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableName = await this.resolveStatusListTableName(queryRunner);
        if (!tableName) {
            return;
        }

        const table = await queryRunner.getTable(tableName);
        if (!table) {
            return;
        }

        if (table.columns.some((col) => col.name === "cwt")) {
            await queryRunner.dropColumn(tableName, "cwt");
        }
    }

    private async resolveStatusListTableName(
        queryRunner: QueryRunner,
    ): Promise<string | null> {
        const candidates = ["status_list_entity", "status_list"];
        for (const candidate of candidates) {
            const table = await queryRunner.getTable(candidate);
            if (table) {
                return candidate;
            }
        }
        return null;
    }
}
