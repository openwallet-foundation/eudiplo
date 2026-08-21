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
        const dbType = queryRunner.connection.driver.options.type;
        const statusListTableName =
            await this.resolveStatusListTableName(queryRunner);

        if (!statusListTableName) {
            console.log(
                "[Migration] status list table not found — skipping version column (schema may not exist yet).",
            );
        } else {
            const statusListTable =
                await queryRunner.getTable(statusListTableName);
            const hasVersionColumn = statusListTable?.columns.some(
                (col) => col.name === "version",
            );
            if (!hasVersionColumn) {
                await queryRunner.addColumn(
                    statusListTableName,
                    new TableColumn({
                        name: "version",
                        type: "integer",
                        isNullable: false,
                        default: 1,
                    }),
                );
                console.log(
                    `[Migration] Added version column to ${statusListTableName}.`,
                );
            }
        }

        const statusMappingTable = await queryRunner.getTable("status_mapping");
        if (!statusMappingTable) {
            console.log(
                "[Migration] status_mapping table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const escape = (identifier: string) =>
            queryRunner.connection.driver.escape(identifier);
        const duplicateQuery = `SELECT ${escape("tenantId")}, ${escape("statusListId")}, ${escape("index")}, COUNT(*) AS count
             FROM ${escape(statusMappingTable.name)}
             GROUP BY ${escape("tenantId")}, ${escape("statusListId")}, ${escape("index")}
             HAVING COUNT(*) > 1`;
        const duplicates = await queryRunner.query(duplicateQuery);

        if (duplicates.length > 0) {
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

        const hasConstraint =
            statusMappingTable.uniques.some(
                (unique) =>
                    unique.name === "UQ_status_mapping_tenant_list_index" ||
                    (unique.columnNames &&
                        unique.columnNames.length === 3 &&
                        unique.columnNames.includes("tenantId") &&
                        unique.columnNames.includes("statusListId") &&
                        unique.columnNames.includes("index")),
            ) ||
            statusMappingTable.indices.some(
                (index) =>
                    index.name === "UQ_status_mapping_tenant_list_index" ||
                    (index.isUnique &&
                        index.columnNames.length === 3 &&
                        index.columnNames.includes("tenantId") &&
                        index.columnNames.includes("statusListId") &&
                        index.columnNames.includes("index")),
            );

        if (!hasConstraint) {
            if (dbType === "postgres") {
                await queryRunner.query(
                    `ALTER TABLE ${escape(statusMappingTable.name)} ADD CONSTRAINT ${escape("UQ_status_mapping_tenant_list_index")} UNIQUE (${escape("tenantId")}, ${escape("statusListId")}, ${escape("index")})`,
                );
            } else if (dbType === "better-sqlite3") {
                await queryRunner.query(
                    `CREATE UNIQUE INDEX ${escape("UQ_status_mapping_tenant_list_index")} ON ${escape(statusMappingTable.name)} (${escape("tenantId")}, ${escape("statusListId")}, ${escape("index")})`,
                );
            } else {
                throw new Error(
                    `Unsupported database type for status-list concurrency migration: ${dbType}`,
                );
            }
            console.log(
                "[Migration] Added unique constraint to status_mapping.",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const dbType = queryRunner.connection.driver.options.type;
        const escape = (identifier: string) =>
            queryRunner.connection.driver.escape(identifier);
        const statusMappingTable = await queryRunner.getTable("status_mapping");

        if (statusMappingTable) {
            if (dbType === "postgres") {
                await queryRunner.query(
                    `ALTER TABLE ${escape(statusMappingTable.name)} DROP CONSTRAINT IF EXISTS ${escape("UQ_status_mapping_tenant_list_index")}`,
                );
            } else if (dbType === "better-sqlite3") {
                await queryRunner.query(
                    `DROP INDEX IF EXISTS ${escape("UQ_status_mapping_tenant_list_index")}`,
                );
            }
            console.log("[Migration] Removed unique status mapping index.");
        }

        const statusListTableName =
            await this.resolveStatusListTableName(queryRunner);
        if (statusListTableName) {
            const statusListTable =
                await queryRunner.getTable(statusListTableName);
            const versionColumn = statusListTable?.columns.find(
                (col) => col.name === "version",
            );
            if (versionColumn) {
                await queryRunner.dropColumn(
                    statusListTableName,
                    versionColumn,
                );
                console.log(
                    `[Migration] Removed version column from ${statusListTableName}.`,
                );
            }
        }
    }

    private async resolveStatusListTableName(
        queryRunner: QueryRunner,
    ): Promise<string | null> {
        for (const candidate of ["status_list_entity", "status_list"]) {
            if (await queryRunner.hasTable(candidate)) {
                return candidate;
            }
        }
        return null;
    }
}
