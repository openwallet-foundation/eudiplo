import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add authorizationServerIssuer to session.
 *
 * Stores the selected authorization server issuer on issuance sessions so
 * external-AS access tokens can be constrained to the configured server that
 * was selected when the offer was created.
 */
export class AddAuthorizationServerIssuerToSession1776000000000
    implements MigrationInterface
{
    name = "AddAuthorizationServerIssuerToSession1776000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable("session");
        if (!sessionTable) {
            console.log(
                "[Migration] session table not found — skipping AddAuthorizationServerIssuerToSession.",
            );
            return;
        }

        if (
            !sessionTable.columns.some(
                (column) => column.name === "authorizationServerIssuer",
            )
        ) {
            await queryRunner.addColumn(
                "session",
                new TableColumn({
                    name: "authorizationServerIssuer",
                    type: "varchar",
                    isNullable: true,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable("session");
        if (!sessionTable) {
            return;
        }

        if (
            sessionTable.columns.some(
                (column) => column.name === "authorizationServerIssuer",
            )
        ) {
            await queryRunner.dropColumn("session", "authorizationServerIssuer");
        }
    }
}
