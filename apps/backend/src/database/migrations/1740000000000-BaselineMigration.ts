import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline Migration - v2.0.0
 *
 * This migration marks the starting point for TypeORM migrations.
 * It supports both installation paths:
 *
 * 1. **Existing installations**: The schema already exists from previous
 *    `synchronize: true` mode. This migration leaves it untouched and is
 *    recorded in the migration history.
 *
 * 2. **New installations**: The current entity metadata is used to create
 *    the complete schema. Later migrations are idempotent and therefore
 *    skip changes already represented by that schema.
 *
 * Future schema changes will be handled by generated migrations.
 */
export class BaselineMigration1740000000000 implements MigrationInterface {
    name = "BaselineMigration1740000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Never run schema synchronization over an existing installation. In
        // particular, this preserves databases created before migrations were
        // introduced and databases whose migration history was not initialized
        // yet.
        const { options, driver } = queryRunner.connection;
        // An unscoped PostgreSQL getTables() also returns pg_catalog and
        // information_schema objects, even for a fresh application database.
        const tables: { name: string }[] =
            options.type === "postgres"
                ? await queryRunner.query(
                      `SELECT table_name AS name FROM information_schema.tables
                       WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
                      [
                          options.schema ??
                              (await queryRunner.getCurrentSchema()),
                      ],
                  )
                : await queryRunner.getTables();
        const migrationsTableName = driver.parseTableName(
            options.migrationsTableName ?? "migrations",
        ).tableName;
        const metadataTableName = driver.parseTableName(
            options.metadataTableName ?? "typeorm_metadata",
        ).tableName;
        const applicationTables = tables.filter(
            (table) =>
                table.name !== migrationsTableName &&
                table.name !== metadataTableName &&
                !table.name.startsWith("sqlite_"),
        );

        if (applicationTables.length > 0) {
            console.log(
                "[Migration] Existing database detected. Marking baseline as complete.",
            );
            return;
        }

        // TypeORM normally executes migrations before `synchronize`. Generate
        // the synchronization SQL from the already-loaded entity metadata and
        // execute it on this migration's query runner so schema creation stays
        // in the migration transaction.
        const schemaQueries = await queryRunner.connection.driver
            .createSchemaBuilder()
            .log();

        for (const query of schemaQueries.upQueries) {
            await queryRunner.query(query.query, query.parameters);
        }

        console.log(
            "[Migration] Fresh database detected. Created schema from entity metadata.",
        );
    }

    public async down(): Promise<void> {
        // This is a baseline marker - nothing to revert
        console.log("[Migration] Baseline migration has nothing to revert.");
    }
}
