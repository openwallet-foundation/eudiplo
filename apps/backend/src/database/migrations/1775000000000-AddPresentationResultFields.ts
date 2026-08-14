import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPresentationResultFields1775000000000
    implements MigrationInterface
{
    name = "AddPresentationResultFields1775000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            return;
        }

        const ensureColumn = async (column: TableColumn) => {
            const exists = table.columns.some(
                (col) => col.name === column.name,
            );
            if (!exists) {
                await queryRunner.addColumn("session", column);
            }
        };

        await ensureColumn(
            new TableColumn({
                name: "responseCodeHash",
                type: "varchar",
                isNullable: true,
            }),
        );

        await ensureColumn(
            new TableColumn({
                name: "responseCodeExpiresAt",
                type:
                    queryRunner.dataSource.options.type === "postgres"
                        ? "timestamp with time zone"
                        : "datetime",
                isNullable: true,
            }),
        );

        await ensureColumn(
            new TableColumn({
                name: "responseCodeConsumedAt",
                type:
                    queryRunner.dataSource.options.type === "postgres"
                        ? "timestamp with time zone"
                        : "datetime",
                isNullable: true,
            }),
        );

        await ensureColumn(
            new TableColumn({
                name: "presentationFailureCode",
                type: "varchar",
                isNullable: true,
            }),
        );

        await ensureColumn(
            new TableColumn({
                name: "presentationFailureProtocolError",
                type: "varchar",
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            return;
        }

        const dropIfExists = async (columnName: string) => {
            const exists = table.columns.some((col) => col.name === columnName);
            if (exists) {
                await queryRunner.dropColumn("session", columnName);
            }
        };

        await dropIfExists("presentationFailureProtocolError");
        await dropIfExists("presentationFailureCode");
        await dropIfExists("responseCodeConsumedAt");
        await dropIfExists("responseCodeExpiresAt");
        await dropIfExists("responseCodeHash");
    }
}
