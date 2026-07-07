import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Remove legacy preferred authorization server selection from issuance_config.
 *
 * Authorization server priority is now inferred from the order of
 * authorizationServers[] in configuration.
 */
export class RemovePreferredAuthServerFromIssuanceConfig1769000000000
    implements MigrationInterface
{
    name = "RemovePreferredAuthServerFromIssuanceConfig1769000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const issuanceConfigTable =
            await queryRunner.getTable("issuance_config");

        if (!issuanceConfigTable) {
            console.log(
                "[Migration] issuance_config table not found - skipping (schema may not exist yet).",
            );
            return;
        }

        const hasPreferredAuthServer = issuanceConfigTable.columns.some(
            (col) => col.name === "preferredAuthServer",
        );
        if (hasPreferredAuthServer) {
            await queryRunner.dropColumn(
                "issuance_config",
                "preferredAuthServer",
            );
            console.log(
                "[Migration] Dropped preferredAuthServer from issuance_config.",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const issuanceConfigTable =
            await queryRunner.getTable("issuance_config");

        if (!issuanceConfigTable) {
            console.log(
                "[Migration] issuance_config table not found - skipping (schema may not exist yet).",
            );
            return;
        }

        const hasPreferredAuthServer = issuanceConfigTable.columns.some(
            (col) => col.name === "preferredAuthServer",
        );
        if (!hasPreferredAuthServer) {
            await queryRunner.addColumn(
                "issuance_config",
                new TableColumn({
                    name: "preferredAuthServer",
                    type: "varchar",
                    isNullable: true,
                }),
            );
            console.log(
                "[Migration] Re-added preferredAuthServer to issuance_config.",
            );
        }
    }
}
