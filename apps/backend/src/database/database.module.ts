import { join } from "node:path";
import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
import * as migrations from "./migrations";
import { buildPostgresSslOptions } from "./postgres-ssl-options";

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (
                configService: ConfigService,
            ): TypeOrmModuleOptions => {
                const dbType = configService.get<"sqlite" | "postgres">(
                    "DB_TYPE",
                );

                // Default synchronize to false for production safety
                // Use DB_SYNCHRONIZE=true only for development or fresh installs
                const synchronize =
                    configService.getOrThrow<boolean>("DB_SYNCHRONIZE");

                // Migrations are enabled by default, disable with DB_MIGRATIONS_RUN=false
                const migrationsRun =
                    configService.getOrThrow<boolean>("DB_MIGRATIONS_RUN");

                const commonOptions = {
                    synchronize,
                    autoLoadEntities: true,
                    migrationsRun,
                    migrations: Object.values(migrations),
                    migrationsTableName: "typeorm_migrations",
                };

                if (dbType === "postgres") {
                    return {
                        type: "postgres",
                        host: configService.getOrThrow<string>("DB_HOST"),
                        port: configService.getOrThrow<number>("DB_PORT"),
                        username:
                            configService.getOrThrow<string>("DB_USERNAME"),
                        password:
                            configService.getOrThrow<string>("DB_PASSWORD"),
                        database:
                            configService.getOrThrow<string>("DB_DATABASE"),
                        ssl: buildPostgresSslOptions((key: string) =>
                            configService.get(key),
                        ),
                        ...commonOptions,
                    } as DataSourceOptions;
                }

                return {
                    type: "better-sqlite3",
                    database: join(
                        configService.getOrThrow<string>("FOLDER"),
                        "service.db",
                    ),
                    ...commonOptions,
                } as DataSourceOptions;
            },
        }),
    ],
})
export class DatabaseModule implements OnModuleInit {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor(private readonly dataSource: DataSource) {}

    async onModuleInit(): Promise<void> {
        const pendingMigrations = await this.dataSource.showMigrations();
        if (pendingMigrations) {
            this.logger.warn(
                "There are pending migrations. Run migrations to apply schema changes.",
            );
        }
    }
}
