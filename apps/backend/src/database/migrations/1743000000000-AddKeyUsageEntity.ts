import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from "typeorm";

/**
 * Migration to add KeyUsageEntity table and migrate data from CertUsageEntity.
 *
 * This migration:
 * 1. Creates the new key_usage_entity table
 * 2. Migrates existing usage assignments from cert_usage_entity to key_usage_entity
 *    by looking up the keyId from cert_entity
 *
 * Usage types are now defined at the key level instead of certificate level,
 * which simplifies the user experience and aligns with the actual data model.
 */
export class AddKeyUsageEntity1743000000000 implements MigrationInterface {
    name = "AddKeyUsageEntity1743000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // On a fresh database, the baseline creates the current schema, so this legacy table won't exist.
        const keyTable = await queryRunner.getTable("key_entity");
        if (!keyTable) {
            console.log(
                "[Migration] key_entity table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        // Check if key_usage_entity already exists
        const table = await queryRunner.getTable("key_usage_entity");
        if (table) {
            console.log(
                "[Migration] key_usage_entity table already exists — skipping creation.",
            );
        } else {
            // Create the key_usage_entity table
            await queryRunner.createTable(
                new Table({
                    name: "key_usage_entity",
                    columns: [
                        {
                            name: "tenantId",
                            type: "varchar",
                            isPrimary: true,
                        },
                        {
                            name: "keyId",
                            type: "varchar",
                            isPrimary: true,
                        },
                        {
                            name: "usage",
                            type: "varchar",
                            isPrimary: true,
                        },
                    ],
                }),
                true,
            );

            // Create index on tenantId + usage for efficient lookups
            await queryRunner.createIndex(
                "key_usage_entity",
                new TableIndex({
                    name: "IDX_key_usage_entity_tenant_usage",
                    columnNames: ["tenantId", "usage"],
                }),
            );

            // Create foreign key to key_entity
            await queryRunner.createForeignKey(
                "key_usage_entity",
                new TableForeignKey({
                    columnNames: ["tenantId", "keyId"],
                    referencedTableName: "key_entity",
                    referencedColumnNames: ["tenantId", "id"],
                    onDelete: "CASCADE",
                }),
            );

            console.log(
                "[Migration] Created key_usage_entity table with index and foreign key.",
            );
        }

        // Migrate data from cert_usage_entity to key_usage_entity
        const certUsageTable = await queryRunner.getTable("cert_usage_entity");
        if (!certUsageTable) {
            console.log(
                "[Migration] cert_usage_entity table not found — skipping data migration.",
            );
            return;
        }

        // Check if there's data to migrate
        const existingData = await queryRunner.query(
            `SELECT COUNT(*) as count FROM cert_usage_entity`,
        );
        const count = existingData[0]?.count || 0;

        if (count === 0) {
            console.log(
                "[Migration] No data in cert_usage_entity — skipping data migration.",
            );
            return;
        }

        console.log(
            `[Migration] Migrating ${count} usage entries from cert_usage_entity to key_usage_entity...`,
        );

        // Migrate: for each cert usage, find the associated key and create key usage
        // Using INSERT ... SELECT with JOIN to efficiently migrate data
        // Note: Column names must be quoted to preserve case in PostgreSQL
        await queryRunner.query(`
            INSERT INTO "key_usage_entity" ("tenantId", "keyId", "usage")
            SELECT DISTINCT cu."tenantId", c."keyId", cu."usage"
            FROM "cert_usage_entity" cu
            INNER JOIN "cert_entity" c ON cu."tenantId" = c."tenantId" AND cu."certId" = c."id"
            WHERE c."keyId" IS NOT NULL
            ON CONFLICT ("tenantId", "keyId", "usage") DO NOTHING
        `);

        console.log("[Migration] Data migration complete.");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: We don't migrate data back since cert_usage_entity is deprecated
        // and will be removed in a future migration

        const table = await queryRunner.getTable("key_usage_entity");
        if (!table) {
            console.log(
                "[Migration] key_usage_entity table not found — nothing to revert.",
            );
            return;
        }

        // Drop foreign keys first
        const foreignKeys = table.foreignKeys;
        for (const fk of foreignKeys) {
            await queryRunner.dropForeignKey("key_usage_entity", fk);
        }

        // Drop index
        const index = table.indices.find(
            (idx) => idx.name === "IDX_key_usage_entity_tenant_usage",
        );
        if (index) {
            await queryRunner.dropIndex("key_usage_entity", index);
        }

        // Drop table
        await queryRunner.dropTable("key_usage_entity");
        console.log("[Migration] Dropped key_usage_entity table.");
    }
}
