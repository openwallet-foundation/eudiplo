import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { DataSource, DataSourceOptions } from "typeorm";
import { buildPostgresSslOptions } from "./postgres-ssl-options.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

// Load environment variables
config({ path: join(currentDir, "..", "..", ".env") });
config({ path: join(currentDir, "..", "..", "..", "..", ".env") });

const dbType = process.env.DB_TYPE as "sqlite" | "postgres" | undefined;

const commonOptions: Partial<DataSourceOptions> = {
    synchronize: false,
    logging: process.env.DB_LOGGING === "true",
    migrations: [join(currentDir, "migrations", "*.{ts,js}")],
    migrationsTableName: "typeorm_migrations",
    // Entity patterns - TypeORM CLI needs explicit patterns
    entities: [join(currentDir, "..", "**", "*.entity.{ts,js}")],
};

let dataSourceOptions: DataSourceOptions;

if (dbType === "postgres") {
    dataSourceOptions = {
        type: "postgres",
        host: process.env.DB_HOST || "localhost",
        port: Number.parseInt(process.env.DB_PORT || "5432", 10),
        username: process.env.DB_USERNAME || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_DATABASE || "eudiplo",
        ssl: buildPostgresSslOptions((key: string) => process.env[key]),
        ...commonOptions,
    } as DataSourceOptions;
} else {
    const folder = process.env.FOLDER || "./assets";
    dataSourceOptions = {
        type: "sqlite",
        database: join(folder, "service.db"),
        ...commonOptions,
    } as DataSourceOptions;
}

export const AppDataSource = new DataSource(dataSourceOptions);
