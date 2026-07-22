import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPresentationStatusCheckMode1773000000000
    implements MigrationInterface
{
    name = "AddPresentationStatusCheckMode1773000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const presentationConfigTable = await queryRunner.getTable(
            "presentation_config",
        );
        if (!presentationConfigTable) {
            console.log(
                "[Migration] presentation_config table not found — skipping.",
            );
            return;
        }

        const hasStatusCheckMode = presentationConfigTable.columns.some(
            (column) => column.name === "statusCheckMode",
        );

        if (!hasStatusCheckMode) {
            await queryRunner.addColumn(
                "presentation_config",
                new TableColumn({
                    name: "statusCheckMode",
                    type: "varchar",
                    isNullable: false,
                    default: "'strict'",
                }),
            );
            console.log(
                "[Migration] Added statusCheckMode column to presentation_config.",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const presentationConfigTable = await queryRunner.getTable(
            "presentation_config",
        );
        if (
            presentationConfigTable?.columns.some(
                (column) => column.name === "statusCheckMode",
            )
        ) {
            await queryRunner.dropColumn(
                "presentation_config",
                "statusCheckMode",
            );
        }
    }
}