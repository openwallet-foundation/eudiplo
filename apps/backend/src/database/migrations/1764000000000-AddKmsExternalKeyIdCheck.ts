import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Defense-in-depth: ensure any key_chain row backed by an external KMS
 * provider records an externalKeyId. For `db` rows the column stays
 * optional (the JWK itself is the private key).
 *
 * Postgres gets a proper CHECK constraint. SQLite has no
 * `ALTER TABLE ADD CONSTRAINT` and is only used in dev/tests, so we
 * enforce the invariant via a trigger there.
 */
export class AddKmsExternalKeyIdCheck1764000000000
    implements MigrationInterface
{
    name = "AddKmsExternalKeyIdCheck1764000000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        const dbType = queryRunner.connection.options.type;
        const table = await queryRunner.getTable("key_chain");
        if (!table) return;

        if (dbType === "postgres") {
            await queryRunner.query(
                `ALTER TABLE "key_chain" ADD CONSTRAINT "chk_key_chain_external_key_id"
                 CHECK ("kmsProvider" = 'db' OR "externalKeyId" IS NOT NULL)`,
            );
        } else if (dbType === "sqlite" || dbType === "better-sqlite3") {
            await queryRunner.query(
                `CREATE TRIGGER IF NOT EXISTS trg_key_chain_external_key_id_ins
                 BEFORE INSERT ON "key_chain"
                 FOR EACH ROW
                 WHEN NEW."kmsProvider" <> 'db' AND NEW."externalKeyId" IS NULL
                 BEGIN
                   SELECT RAISE(ABORT, 'externalKeyId must be set for non-db kmsProvider');
                 END`,
            );
            await queryRunner.query(
                `CREATE TRIGGER IF NOT EXISTS trg_key_chain_external_key_id_upd
                 BEFORE UPDATE ON "key_chain"
                 FOR EACH ROW
                 WHEN NEW."kmsProvider" <> 'db' AND NEW."externalKeyId" IS NULL
                 BEGIN
                   SELECT RAISE(ABORT, 'externalKeyId must be set for non-db kmsProvider');
                 END`,
            );
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const dbType = queryRunner.connection.options.type;
        if (dbType === "postgres") {
            await queryRunner.query(
                `ALTER TABLE "key_chain" DROP CONSTRAINT IF EXISTS "chk_key_chain_external_key_id"`,
            );
        } else if (dbType === "sqlite" || dbType === "better-sqlite3") {
            await queryRunner.query(
                `DROP TRIGGER IF EXISTS "trg_key_chain_external_key_id_ins"`,
            );
            await queryRunner.query(
                `DROP TRIGGER IF EXISTS "trg_key_chain_external_key_id_upd"`,
            );
        }
    }
}
