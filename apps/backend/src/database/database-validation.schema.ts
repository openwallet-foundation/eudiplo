import Joi from "joi";

export const DB_VALIDATION_SCHEMA = Joi.object({
    DB_TYPE: Joi.string()
        .valid("sqlite", "postgres")
        .default("sqlite")
        .description("Database type")
        .meta({ group: "database", order: 10 }),
    DB_HOST: Joi.string()
        .when("DB_TYPE", {
            is: "sqlite",
            then: Joi.optional().allow(""),
            otherwise: Joi.required(),
        })
        .description("Database host")
        .meta({ group: "database", order: 15 }),
    DB_PORT: Joi.number()
        .when("DB_TYPE", {
            is: "sqlite",
            then: Joi.optional().allow(""),
            otherwise: Joi.required(),
        })
        .description("Database port")
        .meta({ group: "database", order: 20 }),
    DB_USERNAME: Joi.string()
        .when("DB_TYPE", {
            is: "sqlite",
            then: Joi.optional().allow(""),
            otherwise: Joi.required(),
        })
        .description("Database username")
        .meta({ group: "database", order: 30 }),
    DB_PASSWORD: Joi.string()
        .when("DB_TYPE", {
            is: "sqlite",
            then: Joi.optional().allow(""),
            otherwise: Joi.required(),
        })
        .description("Database password")
        .meta({ group: "database", order: 40 }),
    DB_DATABASE: Joi.string()
        .when("DB_TYPE", {
            is: "sqlite",
            then: Joi.optional().allow(""),
            otherwise: Joi.required(),
        })
        .description("Database name")
        .meta({ group: "database", order: 50 }),
    DB_SSL: Joi.boolean()
        .default(false)
        .description("Enable SSL/TLS for PostgreSQL database connections")
        .meta({ group: "database", order: 55 }),
    DB_SSL_REJECT_UNAUTHORIZED: Joi.boolean()
        .default(true)
        .description(
            "Reject PostgreSQL TLS certificates that cannot be validated against trusted CAs",
        )
        .meta({ group: "database", order: 56 }),
    DB_SSL_CA_PATH: Joi.string()
        .optional()
        .allow("")
        .description(
            "Path to CA certificate file used to validate PostgreSQL TLS certificates",
        )
        .meta({ group: "database", order: 57 }),
    DB_SSL_CERT_PATH: Joi.string()
        .optional()
        .allow("")
        .description("Path to client certificate file for PostgreSQL TLS")
        .meta({ group: "database", order: 58 }),
    DB_SSL_KEY_PATH: Joi.string()
        .optional()
        .allow("")
        .description("Path to client private key file for PostgreSQL TLS")
        .meta({ group: "database", order: 59 }),
    DB_SSL_KEY_PASSPHRASE: Joi.string()
        .optional()
        .allow("")
        .description("Passphrase for encrypted DB_SSL_KEY_PATH private key")
        .meta({ group: "database", order: 60 }),
    DB_SYNCHRONIZE: Joi.boolean()
        .default(true)
        .description(
            "Enable TypeORM schema synchronization. Set to false in production after initial setup and rely on migrations instead.",
        )
        .meta({ group: "database", order: 70 }),
    DB_MIGRATIONS_RUN: Joi.boolean()
        .default(true)
        .description("Run pending database migrations automatically on startup")
        .meta({ group: "database", order: 80 }),
});
