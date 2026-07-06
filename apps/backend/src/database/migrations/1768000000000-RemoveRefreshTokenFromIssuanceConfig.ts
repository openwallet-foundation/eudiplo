import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Remove legacy refresh token settings from issuance_config.
 *
 * Refresh token behavior is now configured per authorization server
 * via authorizationServers[].token.
 */
export class RemoveRefreshTokenFromIssuanceConfig1768000000000
    implements MigrationInterface
{
    name = "RemoveRefreshTokenFromIssuanceConfig1768000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const issuanceConfigTable =
            await queryRunner.getTable("issuance_config");

        if (!issuanceConfigTable) {
            console.log(
                "[Migration] issuance_config table not found - skipping (schema may not exist yet).",
            );
            return;
        }

        const hasRefreshTokenExpiresInSeconds = issuanceConfigTable.columns.some(
            (col) => col.name === "refreshTokenExpiresInSeconds",
        );
        if (hasRefreshTokenExpiresInSeconds) {
            await queryRunner.dropColumn(
                "issuance_config",
                "refreshTokenExpiresInSeconds",
            );
            console.log(
                "[Migration] Dropped refreshTokenExpiresInSeconds from issuance_config.",
            );
        }

        const hasRefreshTokenEnabled = issuanceConfigTable.columns.some(
            (col) => col.name === "refreshTokenEnabled",
        );
        if (hasRefreshTokenEnabled) {
            await queryRunner.dropColumn(
                "issuance_config",
                "refreshTokenEnabled",
            );
            console.log(
                "[Migration] Dropped refreshTokenEnabled from issuance_config.",
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

        const hasRefreshTokenEnabled = issuanceConfigTable.columns.some(
            (col) => col.name === "refreshTokenEnabled",
        );
        if (!hasRefreshTokenEnabled) {
            await queryRunner.addColumn(
                "issuance_config",
                new TableColumn({
                    name: "refreshTokenEnabled",
                    type: "boolean",
                    default: true,
                    isNullable: false,
                }),
            );
            console.log(
                "[Migration] Re-added refreshTokenEnabled to issuance_config.",
            );
        }

        const hasRefreshTokenExpiresInSeconds = issuanceConfigTable.columns.some(
            (col) => col.name === "refreshTokenExpiresInSeconds",
        );
        if (!hasRefreshTokenExpiresInSeconds) {
            await queryRunner.addColumn(
                "issuance_config",
                new TableColumn({
                    name: "refreshTokenExpiresInSeconds",
                    type: "int",
                    default: 2592000,
                    isNullable: true,
                }),
            );
            console.log(
                "[Migration] Re-added refreshTokenExpiresInSeconds to issuance_config.",
            );
        }
    }
}
