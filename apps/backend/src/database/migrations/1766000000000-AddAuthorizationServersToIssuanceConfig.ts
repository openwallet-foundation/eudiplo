import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAuthorizationServersToIssuanceConfig1766000000000
    implements MigrationInterface
{
    name = "AddAuthorizationServersToIssuanceConfig1766000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("issuance_config");
        if (!table) {
            console.log(
                "[Migration] issuance_config table not found — skipping authorizationServers column.",
            );
            return;
        }

        const hasColumn = table.columns.some(
            (col) => col.name === "authorizationServers",
        );
        if (hasColumn) {
            console.log(
                "[Migration] authorizationServers column already exists — skipping.",
            );
            return;
        }

        await queryRunner.addColumn(
            "issuance_config",
            new TableColumn({
                name: "authorizationServers",
                type: "json",
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("issuance_config");
        if (!table) {
            return;
        }

        const hasColumn = table.columns.some(
            (col) => col.name === "authorizationServers",
        );
        if (hasColumn) {
            await queryRunner.dropColumn(
                "issuance_config",
                "authorizationServers",
            );
        }
    }
}
