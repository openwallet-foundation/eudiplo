import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add consumed and consumedAt columns to session table.
 *
 * This migration adds two columns to track single-use validation for offers:
 * - consumed: boolean flag indicating whether the offer has been consumed
 * - consumedAt: timestamp of when the offer was consumed
 *
 * This implements the single-use validation feature to prevent replay attacks
 * and ensure each credential offer or presentation request can only be used once.
 */
export class AddSessionSingleUseTracking1760000000000
    implements MigrationInterface
{
    name = "AddSessionSingleUseTracking1760000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            console.log(
                "[Migration] session table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasConsumedColumn = table.columns.some(
            (col) => col.name === "consumed",
        );
        if (hasConsumedColumn) {
            console.log(
                "[Migration] consumed column already exists — skipping.",
            );
            return;
        }

        // Add consumed column
        await queryRunner.addColumn(
            "session",
            new TableColumn({
                name: "consumed",
                type: "boolean",
                default: false,
                isNullable: false,
            }),
        );

        // Add consumedAt column
        await queryRunner.addColumn(
            "session",
            new TableColumn({
                name: "consumedAt",
                type:
                    queryRunner.connection.driver.options.type ===
                    "better-sqlite3"
                        ? "datetime"
                        : "timestamp",
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            console.log(
                "[Migration] session table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasConsumedColumn = table.columns.some(
            (col) => col.name === "consumed",
        );
        if (hasConsumedColumn) {
            await queryRunner.dropColumn("session", "consumed");
        }

        const hasConsumedAtColumn = table.columns.some(
            (col) => col.name === "consumedAt",
        );
        if (hasConsumedAtColumn) {
            await queryRunner.dropColumn("session", "consumedAt");
        }
    }
}
