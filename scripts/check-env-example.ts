#!/usr/bin/env tsx
/**
 * Validates the *live* (uncommented) key/value pairs in .env.example against
 * the backend's Joi schema, so a newly-required env var (including one only
 * required for the default DB_TYPE/OIDC/etc. path) can't go undocumented.
 * Commented-out lines represent optional/alternate settings and are ignored.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Joi from "joi";
import { VALIDATION_SCHEMA } from "../apps/backend/src/platform/config/combined.schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_EXAMPLE_PATH = resolve(__dirname, "../.env.example");

function parseLiveEnv(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (match) {
            env[match[1]] = match[2];
        }
    }
    return env;
}

function main() {
    const envExample = readFileSync(ENV_EXAMPLE_PATH, "utf8");
    const liveEnv = parseLiveEnv(envExample);

    const { error } = (VALIDATION_SCHEMA as Joi.ObjectSchema).validate(liveEnv, {
        allowUnknown: true,
        abortEarly: false,
    });

    const missing = (error?.details ?? []).filter(
        (detail) => detail.type === "any.required",
    );

    if (missing.length > 0) {
        console.error(
            "The default configuration in .env.example is missing required environment variables:",
        );
        for (const detail of missing) console.error(`  - ${detail.path.join(".")}`);
        console.error(
            "\nAdd them (with a placeholder value) to .env.example so the default config is valid out of the box.",
        );
        process.exit(1);
    }

    console.log(
        ".env.example's default configuration satisfies all required environment variables.",
    );
}

main();

