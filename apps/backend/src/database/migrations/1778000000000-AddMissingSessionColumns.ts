import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adds two `session` columns that exist on SessionEntity but that no migration
 * ever created:
 *
 * - `responseEncryptionPrivateJwk`, added to the entity in #894 (7.0.0).
 *   Without it, `POST /api/verifier/offer` fails with
 *   `QueryFailedError: column Session.responseEncryptionPrivateJwk does not exist`.
 * - `authorizationServerId`, the same omission on the issuance path.
 *
 * Fresh installs come up with `DB_SYNCHRONIZE=true`, so TypeORM creates the
 * columns and the gap is invisible there. Deployments that upgrade with
 * migrations only — the setting `data-source.ts` hardcodes for production —
 * end up with a schema the code cannot query.
 *
 * Idempotent, so it is a no-op where synchronize already created them.
 */
export class AddMissingSessionColumns1778000000000
    implements MigrationInterface
{
    name = "AddMissingSessionColumns1778000000000";

    private readonly columns = [
        new TableColumn({
            name: "responseEncryptionPrivateJwk",
            type: "text",
            isNullable: true,
        }),
        new TableColumn({
            name: "authorizationServerId",
            type: "varchar",
            isNullable: true,
        }),
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) {
            console.log("[Migration] session table not found — skipping.");
            return;
        }

        for (const column of this.columns) {
            if (table.columns.some((c) => c.name === column.name)) continue;
            await queryRunner.addColumn("session", column);
            console.log(`[Migration] Added ${column.name} to session.`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("session");
        if (!table) return;

        for (const column of this.columns) {
            if (!table.columns.some((c) => c.name === column.name)) continue;
            await queryRunner.dropColumn("session", column.name);
        }
    }
}
