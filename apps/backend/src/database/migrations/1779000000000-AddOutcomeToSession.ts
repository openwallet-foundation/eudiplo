import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add the `failureCode` and `outcome` columns to `session`.
 *
 * `failureCode` holds the machine-readable verification failure code when a
 * session fails; `outcome` holds the structured verification result (success or
 * failure, provenance and per-credential diagnostics). Both nullable and
 * additive to the existing `status` / `errorReason`.
 */
export class AddOutcomeToSession1779000000000 implements MigrationInterface {
    name = "AddOutcomeToSession1779000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            console.log("[Migration] session table not found — skipping.");
            return;
        }

        if (!table.columns.some((c) => c.name === "failureCode")) {
            await queryRunner.addColumn(
                "session",
                new TableColumn({
                    name: "failureCode",
                    type: "varchar",
                    isNullable: true,
                }),
            );
            console.log("[Migration] Added failureCode column to session.");
        }

        if (!table.columns.some((c) => c.name === "outcome")) {
            await queryRunner.addColumn(
                "session",
                new TableColumn({
                    name: "outcome",
                    type: "json",
                    isNullable: true,
                }),
            );
            console.log("[Migration] Added outcome column to session.");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) return;

        if (table.columns.some((c) => c.name === "outcome")) {
            await queryRunner.dropColumn("session", "outcome");
        }
        if (table.columns.some((c) => c.name === "failureCode")) {
            await queryRunner.dropColumn("session", "failureCode");
        }
    }
}
