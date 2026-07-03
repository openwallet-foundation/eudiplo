import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adds issuer-level registration certificate configuration and cache columns to issuance_config.
 */
export class AddIssuerRegistrationCertificateToIssuanceConfig1767000000000
    implements MigrationInterface
{
    name = "AddIssuerRegistrationCertificateToIssuanceConfig1767000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const isPostgres = queryRunner.connection.options.type === "postgres";
        const table = await queryRunner.getTable("issuance_config");

        if (!table) {
            console.log(
                "[Migration] issuance_config table not found - skipping.",
            );
            return;
        }

        if (!table.columns.some((col) => col.name === "registrationCertificate")) {
            await queryRunner.addColumn(
                "issuance_config",
                new TableColumn({
                    name: "registrationCertificate",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }

        if (!table.columns.some((col) => col.name === "registrationCertificateCache")) {
            await queryRunner.addColumn(
                "issuance_config",
                new TableColumn({
                    name: "registrationCertificateCache",
                    type: isPostgres ? "jsonb" : "json",
                    isNullable: true,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("issuance_config");
        if (!table) {
            return;
        }

        if (table.columns.some((col) => col.name === "registrationCertificateCache")) {
            await queryRunner.dropColumn(
                "issuance_config",
                "registrationCertificateCache",
            );
        }

        if (table.columns.some((col) => col.name === "registrationCertificate")) {
            await queryRunner.dropColumn("issuance_config", "registrationCertificate");
        }
    }
}
