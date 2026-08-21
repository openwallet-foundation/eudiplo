import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add version column to status_list table for optimistic locking.
 * Add unique constraint to status_mapping for (tenantId, statusListId, index).
 *
 * This enables concurrency-safe Status List operations across:
 * - Multiple requests
 * - Multiple EUDIPLO application instances
 * - PostgreSQL and SQLite
 *
 * The version column is used for optimistic locking to detect concurrent modifications.
 * The unique constraint prevents duplicate allocations of the same Status List index.
 */
export class AddStatusListVersionAndUniqueConstraint1776000000000
    implements MigrationInterface
{
    name = "AddStatusListVersionAndUniqueConstraint1776000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Determine database type for dialect-specific SQL
        const dbType = queryRunner.connection.driver.options.type;

        // Add version column to status_list
        const statusListTable = await queryRunner.getTable("status_list");
        if (!statusListTable) {
            console.log(
                "[Migration] status_list table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasVersionColumn = statusListTable.columns.some(
            (col) => col.name === "version",
        );
        if (!hasVersionColumn) {
            await queryRunner.addColumn(
                "status_list",
                new TableColumn({
                    name: "version",
                    type: "integer",
                    isNullable: false,
                    default: 1,
                }),
            );
            console.log("[Migration] Added version column to status_list.");
        }

        // Check for duplicates before adding unique constraint
        let duplicateQuery = `SELECT "tenantId", "statusListId", "index", COUNT(*) as count
             FROM status_mapping
             GROUP BY "tenantId", "statusListId", "index"
             HAVING COUNT(*) > 1`;

        // SQLite uses different quote style
        if (dbType === "better-sqlite3") {
            duplicateQuery = `SELECT tenantId, statusListId, "index", COUNT(*) as count
             FROM status_mapping
             GROUP BY tenantId, statusListId, "index"
             HAVING COUNT(*) > 1`;
        }

        const duplicates = await queryRunner.query(duplicateQuery);

        if (duplicates && duplicates.length > 0) {
            console.error(
                "[Migration] ERROR: Found duplicate allocations in status_mapping:",
            );
            for (const dup of duplicates) {
                console.error(
                    `  - Tenant: ${dup.tenantId}, List: ${dup.statusListId}, Index: ${dup.index} (${dup.count} allocations)`,
                );
            }
            throw new Error(
                "Cannot add unique constraint: duplicate (tenantId, statusListId, index) tuples exist. " +
                    "See error details above. These duplicates must be manually resolved before migration can proceed.",
            );
        }

        // Add unique constraint to status_mapping using raw SQL
        // This is more portable than using the QueryRunner API which differs between TypeORM versions
        const statusMappingTable = await queryRunner.getTable("status_mapping");
        if (!statusMappingTable) {
            console.log(
                "[Migration] status_mapping table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasConstraint = statusMappingTable.uniques.some(
            (unique) =>
                unique.name === "UQ_status_mapping_tenant_list_index" ||
                (unique.columnNames &&
                    unique.columnNames.length === 3 &&
                    unique.columnNames.includes("tenantId") &&
                    unique.columnNames.includes("statusListId") &&
                    unique.columnNames.includes("index")),
        );

        if (!hasConstraint) {
            // Create unique constraint using raw SQL for better compatibility
            if (dbType === "postgres") {
                await queryRunner.query(
                    `ALTER TABLE status_mapping ADD CONSTRAINT UQ_status_mapping_tenant_list_index UNIQUE ("tenantId", "statusListId", "index")`,
                );
            } else if (dbType === "better-sqlite3") {
                // SQLite doesn't support adding unique constraints to existing tables directly
                // We'll create it via a raw statement
                await queryRunner.query(
                    `CREATE UNIQUE INDEX UQ_status_mapping_tenant_list_index ON status_mapping (tenantId, statusListId, "index")`,
                );
            } else {
                // Fallback for other databases
                await queryRunner.query(
                    `ALTER TABLE status_mapping ADD CONSTRAINT UQ_status_mapping_tenant_list_index UNIQUE (tenantId, statusListId, \`index\`)`,
                );
            }
            console.log(
                "[Migration] Added unique constraint to status_mapping.",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Determine database type for dialect-specific SQL
        const dbType = queryRunner.connection.driver.options.type;

        // Remove unique constraint using raw SQL
        try {
            if (dbType === "postgres") {
                await queryRunner.query(
                    `ALTER TABLE status_mapping DROP CONSTRAINT IF EXISTS UQ_status_mapping_tenant_list_index`,
                );
            } else if (dbType === "better-sqlite3") {
                await queryRunner.query(
                    `DROP INDEX IF EXISTS UQ_status_mapping_tenant_list_index`,
                );
            } else {
                await queryRunner.query(
                    `ALTER TABLE status_mapping DROP INDEX UQ_status_mapping_tenant_list_index`,
                );
            }
            console.log(
                "[Migration] Removed unique constraint from status_mapping.",
            );
        } catch (_error) {
            console.log(
                "[Migration] Could not remove unique constraint (may not exist).",
            );
        }

        // Remove version column
        const statusListTable = await queryRunner.getTable("status_list");
        if (statusListTable) {
            const versionColumn = statusListTable.columns.find(
                (col) => col.name === "version",
            );
            if (versionColumn) {
                await queryRunner.dropColumn("status_list", versionColumn);
                console.log(
                    "[Migration] Removed version column from status_list.",
                );
            }
        }
    }
}
