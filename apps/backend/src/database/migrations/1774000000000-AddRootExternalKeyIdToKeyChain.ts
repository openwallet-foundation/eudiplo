import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add rootExternalKeyId to key_chain.
 *
 * This stores the external KMS key identifier for the root CA key in
 * internal-chain key chains, so later rotations can reference the exact
 * root key in external KMS backends without relying on fallback heuristics.
 */
export class AddRootExternalKeyIdToKeyChain1774000000000
    implements MigrationInterface
{
    name = "AddRootExternalKeyIdToKeyChain1774000000000";

    async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("key_chain");
        if (!table) return;

        const hasColumn = table.columns.some(
            (col) => col.name === "rootExternalKeyId",
        );
        if (hasColumn) {
            return;
        }

        await queryRunner.addColumn(
            "key_chain",
            new TableColumn({
                name: "rootExternalKeyId",
                type: "varchar",
                isNullable: true,
            }),
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("key_chain");
        if (!table) return;

        const hasColumn = table.columns.some(
            (col) => col.name === "rootExternalKeyId",
        );
        if (!hasColumn) {
            return;
        }

        await queryRunner.dropColumn("key_chain", "rootExternalKeyId");
    }
}
