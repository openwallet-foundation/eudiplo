import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddVerifierSkewSeconds1772000000000 implements MigrationInterface {
    name = "AddVerifierSkewSeconds1772000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const presentationConfigTable = await queryRunner.getTable(
            "presentation_config",
        );
        if (presentationConfigTable) {
            const hasSkewSeconds = presentationConfigTable.columns.some(
                (column) => column.name === "skewSeconds",
            );
            if (!hasSkewSeconds) {
                await queryRunner.addColumn(
                    "presentation_config",
                    new TableColumn({
                        name: "skewSeconds",
                        type: "int",
                        isNullable: false,
                        default: 60,
                    }),
                );
                console.log(
                    "[Migration] Added skewSeconds column to presentation_config.",
                );
            }
        } else {
            console.log(
                "[Migration] presentation_config table not found — skipping.",
            );
        }

        const sessionTable = await queryRunner.getTable("session");
        if (sessionTable) {
            const hasSkewSeconds = sessionTable.columns.some(
                (column) => column.name === "skewSeconds",
            );
            if (!hasSkewSeconds) {
                await queryRunner.addColumn(
                    "session",
                    new TableColumn({
                        name: "skewSeconds",
                        type: "int",
                        isNullable: true,
                    }),
                );
                console.log("[Migration] Added skewSeconds column to session.");
            }
        } else {
            console.log("[Migration] session table not found — skipping.");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable("session");
        if (
            sessionTable?.columns.some(
                (column) => column.name === "skewSeconds",
            )
        ) {
            await queryRunner.dropColumn("session", "skewSeconds");
        }

        const presentationConfigTable = await queryRunner.getTable(
            "presentation_config",
        );
        if (
            presentationConfigTable?.columns.some(
                (column) => column.name === "skewSeconds",
            )
        ) {
            await queryRunner.dropColumn("presentation_config", "skewSeconds");
        }
    }
}
