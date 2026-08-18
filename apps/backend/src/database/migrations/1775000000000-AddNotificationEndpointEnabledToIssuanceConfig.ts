import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add notificationEndpointEnabled column to issuance_config table.
 *
 * This defaults to true so existing issuance configurations continue to expose
 * the notification endpoint unless explicitly disabled on a per-config basis.
 */
export class AddNotificationEndpointEnabledToIssuanceConfig1775000000000
    implements MigrationInterface
{
    name = "AddNotificationEndpointEnabledToIssuanceConfig1775000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("issuance_config");
        if (!table) {
            console.log(
                "[Migration] issuance_config table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasColumn = table.columns.some(
            (col) => col.name === "notificationEndpointEnabled",
        );
        if (hasColumn) {
            console.log(
                "[Migration] notificationEndpointEnabled column already exists — skipping.",
            );
            return;
        }

        await queryRunner.addColumn(
            "issuance_config",
            new TableColumn({
                name: "notificationEndpointEnabled",
                type: "boolean",
                isNullable: false,
                default: true,
            }),
        );

        console.log(
            "[Migration] Added notificationEndpointEnabled column to issuance_config.",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("issuance_config");
        if (table) {
            const hasColumn = table.columns.some(
                (col) => col.name === "notificationEndpointEnabled",
            );
            if (hasColumn) {
                await queryRunner.dropColumn(
                    "issuance_config",
                    "notificationEndpointEnabled",
                );
                console.log(
                    "[Migration] Removed notificationEndpointEnabled column from issuance_config.",
                );
            }
        }
    }
}
