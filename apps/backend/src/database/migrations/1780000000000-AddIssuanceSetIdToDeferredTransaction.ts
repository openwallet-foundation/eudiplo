import {
    type MigrationInterface,
    type QueryRunner,
    TableColumn,
} from "typeorm";

export class AddIssuanceSetIdToDeferredTransaction1780000000000
    implements MigrationInterface
{
    name = "AddIssuanceSetIdToDeferredTransaction1780000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("deferred_transaction_entity");
        if (
            !table ||
            table.columns.some((column) => column.name === "issuanceSetId")
        ) {
            return;
        }

        await queryRunner.addColumn(
            table.name,
            new TableColumn({
                name: "issuanceSetId",
                type: "varchar",
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("deferred_transaction_entity");
        if (table?.columns.some((column) => column.name === "issuanceSetId")) {
            await queryRunner.dropColumn(table.name, "issuanceSetId");
        }
    }
}
