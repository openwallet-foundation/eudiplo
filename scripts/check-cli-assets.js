#!/usr/bin/env node
/**
 * Ensures CLI-packaged deployment assets stay in sync with the canonical repo
 * deployment files.
 */

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const canonicalComposePath = join(
    __dirname,
    "../deployment/docker-compose/docker-compose.yml",
);
const cliComposePath = join(__dirname, "../apps/cli/templates/docker-compose.yml");

const canonicalCompose = readFileSync(canonicalComposePath, "utf8");
const cliCompose = readFileSync(cliComposePath, "utf8");

if (canonicalCompose !== cliCompose) {
    console.error(
        "apps/cli/templates/docker-compose.yml is out of sync with deployment/docker-compose/docker-compose.yml",
    );
    console.error(
        "Copy the canonical Compose file into apps/cli/templates/docker-compose.yml before building the CLI.",
    );
    process.exit(1);
}

console.log("CLI deployment assets are in sync.");