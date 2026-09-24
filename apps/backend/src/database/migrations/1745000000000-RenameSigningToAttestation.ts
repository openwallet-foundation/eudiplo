import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to rename usage type from "signing" to "attestation".
 */
export class RenameSigningToAttestation1745000000000
    implements MigrationInterface
{
    name = "RenameSigningToAttestation1745000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // On a fresh database, the baseline creates the current schema, so this legacy table won't exist.
        const table = await queryRunner.getTable("key_usage_entity");
        if (!table) {
            console.log(
                "[Migration] key_usage_entity table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        // Update key_usage_entity usage column from 'signing' to 'attestation'
        await queryRunner.query(
            `UPDATE "key_usage_entity" SET "usage" = 'attestation' WHERE "usage" = 'signing'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("key_usage_entity");
        if (!table) {
            return;
        }

        // Revert: update key_usage_entity usage column from 'attestation' to 'signing'
        await queryRunner.query(
            `UPDATE "key_usage_entity" SET "usage" = 'signing' WHERE "usage" = 'attestation'`,
        );
    }
}
