import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Renames `key_chain.activeKey`/`rootKey`/`previousKey` columns to
 * `activeJwk`/`rootJwk`/`previousJwk` to reflect that these columns
 * always store JWK material (private for the `db` provider, public-only
 * for external KMS providers) and never raw bytes.
 *
 * BREAKING CHANGE: anything reading these columns directly (e.g. ad-hoc
 * SQL, custom dashboards) must be updated. Application code uses the
 * TypeORM entity, which has been renamed in lockstep.
 */
export class RenameKeyChainActiveKeyToActiveJwk1765000000000
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Skip on fresh installs where TypeORM sync has already created
        // the renamed columns directly from the current entity. Both
        // SQLite (3.25+) and PostgreSQL support `RENAME COLUMN`.
        const table = await queryRunner.getTable("key_chain");
        if (!table) return;
        const hasColumn = (name: string) =>
            table.columns.some((c) => c.name === name);

        if (hasColumn("activeKey") && !hasColumn("activeJwk")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "activeKey" TO "activeJwk"`,
            );
        }
        if (hasColumn("rootKey") && !hasColumn("rootJwk")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "rootKey" TO "rootJwk"`,
            );
        }
        if (hasColumn("previousKey") && !hasColumn("previousJwk")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "previousKey" TO "previousJwk"`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("key_chain");
        if (!table) return;
        const hasColumn = (name: string) =>
            table.columns.some((c) => c.name === name);

        if (hasColumn("previousJwk") && !hasColumn("previousKey")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "previousJwk" TO "previousKey"`,
            );
        }
        if (hasColumn("rootJwk") && !hasColumn("rootKey")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "rootJwk" TO "rootKey"`,
            );
        }
        if (hasColumn("activeJwk") && !hasColumn("activeKey")) {
            await queryRunner.query(
                `ALTER TABLE "key_chain" RENAME COLUMN "activeJwk" TO "activeKey"`,
            );
        }
    }
}
