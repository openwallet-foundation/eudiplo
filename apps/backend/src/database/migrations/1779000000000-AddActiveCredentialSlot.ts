import {
    type MigrationInterface,
    type QueryRunner,
    Table,
    TableColumn,
    TableIndex,
} from "typeorm";

/**
 * Adds the storage for the active-credential-limit policy (issue #843).
 *
 * - `active_credential_slot`: at most one row per
 *   (tenantId, credentialConfigurationId, subjectScopedKey), enforced by a
 *   unique constraint. This constraint is the concurrency backstop: two
 *   simultaneous first issuances for the same subject cannot both insert.
 * - `status_mapping.issuanceSetId`: opaque grouping of the status entries
 *   allocated for one issuance, so a subject's previously active set can be
 *   revoked without storing any subject-derived value on the mappings.
 *
 * Both additions are nullable / additive, so existing rows and issuance that
 * does not use the policy are unaffected.
 */
export class AddActiveCredentialSlot1779000000000
    implements MigrationInterface
{
    name = "AddActiveCredentialSlot1779000000000";

    private readonly slotTable = "active_credential_slot";
    private readonly mappingTable = "status_mapping";
    private readonly issuanceSetIndex = "IDX_status_mapping_issuance_set";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const dbType = queryRunner.connection.driver.options.type;
        const isSqlite = dbType === "better-sqlite3" || dbType === "sqlite";

        if (!(await queryRunner.hasTable(this.slotTable))) {
            await queryRunner.createTable(
                new Table({
                    name: this.slotTable,
                    columns: [
                        {
                            name: "id",
                            type: "varchar",
                            isPrimary: true,
                        },
                        {
                            name: "tenantId",
                            type: "varchar",
                            isNullable: false,
                        },
                        {
                            name: "credentialConfigurationId",
                            type: "varchar",
                            isNullable: false,
                        },
                        {
                            name: "subjectScopedKey",
                            type: "varchar",
                            isNullable: false,
                        },
                        {
                            name: "issuanceSetId",
                            type: "varchar",
                            isNullable: true,
                        },
                        {
                            name: "version",
                            type: "integer",
                            isNullable: false,
                            default: 1,
                        },
                        {
                            name: "createdAt",
                            type: isSqlite ? "datetime" : "timestamp",
                            default: "CURRENT_TIMESTAMP",
                        },
                        {
                            name: "updatedAt",
                            type: isSqlite ? "datetime" : "timestamp",
                            default: "CURRENT_TIMESTAMP",
                        },
                    ],
                    uniques: [
                        {
                            name: "UQ_active_credential_slot_subject",
                            columnNames: [
                                "tenantId",
                                "credentialConfigurationId",
                                "subjectScopedKey",
                            ],
                        },
                    ],
                    foreignKeys: [
                        {
                            columnNames: ["tenantId"],
                            referencedTableName: "tenant_entity",
                            referencedColumnNames: ["id"],
                            onDelete: "CASCADE",
                        },
                    ],
                }),
                true,
            );
            console.log(`[Migration] Created ${this.slotTable} table.`);
        }

        const mapping = await queryRunner.getTable(this.mappingTable);
        if (!mapping) {
            console.log(
                `[Migration] ${this.mappingTable} table not found — skipping issuanceSetId column.`,
            );
            return;
        }

        if (!mapping.columns.some((col) => col.name === "issuanceSetId")) {
            await queryRunner.addColumn(
                this.mappingTable,
                new TableColumn({
                    name: "issuanceSetId",
                    type: "varchar",
                    isNullable: true,
                }),
            );
            console.log(
                `[Migration] Added issuanceSetId column to ${this.mappingTable}.`,
            );
        }

        if (
            !mapping.indices.some((idx) => idx.name === this.issuanceSetIndex)
        ) {
            await queryRunner.createIndex(
                this.mappingTable,
                new TableIndex({
                    name: this.issuanceSetIndex,
                    columnNames: ["issuanceSetId"],
                }),
            );
            console.log(
                `[Migration] Added ${this.issuanceSetIndex} index to ${this.mappingTable}.`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const mapping = await queryRunner.getTable(this.mappingTable);
        if (mapping) {
            if (
                mapping.indices.some(
                    (idx) => idx.name === this.issuanceSetIndex,
                )
            ) {
                await queryRunner.dropIndex(
                    this.mappingTable,
                    this.issuanceSetIndex,
                );
            }
            if (mapping.columns.some((col) => col.name === "issuanceSetId")) {
                await queryRunner.dropColumn(
                    this.mappingTable,
                    "issuanceSetId",
                );
            }
        }

        if (await queryRunner.hasTable(this.slotTable)) {
            await queryRunner.dropTable(this.slotTable);
            console.log(`[Migration] Dropped ${this.slotTable} table.`);
        }
    }
}
