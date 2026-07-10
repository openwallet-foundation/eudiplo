import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDcApiProtocolToSession1770000000000
    implements MigrationInterface
{
    name = "AddDcApiProtocolToSession1770000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable("session");
        if (!sessionTable) {
            console.log(
                "[Migration] session table not found — skipping.",
            );
            return;
        }

        if (!sessionTable.columns.some((c) => c.name === "dcApiProtocol")) {
            await queryRunner.addColumn(
                "session",
                new TableColumn({
                    name: "dcApiProtocol",
                    type: "varchar",
                    isNullable: true,
                }),
            );
            console.log("[Migration] Added dcApiProtocol column to session.");
        }

        if (!sessionTable.columns.some((c) => c.name === "browserOrigin")) {
            await queryRunner.addColumn(
                "session",
                new TableColumn({
                    name: "browserOrigin",
                    type: "varchar",
                    isNullable: true,
                }),
            );
            console.log("[Migration] Added browserOrigin column to session.");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable("session");
        if (!sessionTable) return;

        if (sessionTable.columns.some((c) => c.name === "browserOrigin")) {
            await queryRunner.dropColumn("session", "browserOrigin");
        }
        if (sessionTable.columns.some((c) => c.name === "dcApiProtocol")) {
            await queryRunner.dropColumn("session", "dcApiProtocol");
        }
    }
}
