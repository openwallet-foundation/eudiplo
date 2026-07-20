#!/usr/bin/env node
/**
 * Syncs the CLI version with the main EUDIPLO release version.
 * Called by semantic-release during the prepare phase.
 *
 * Usage: node scripts/sync-cli-version.js <version>
 */

const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const version = process.argv[2];

if (!version) {
    console.error("Usage: node sync-cli-version.js <version>");
    process.exit(1);
}

const cliPackagePath = join(__dirname, "../apps/cli/package.json");

try {
    const pkg = JSON.parse(readFileSync(cliPackagePath, "utf-8"));
    pkg.version = version;
    writeFileSync(cliPackagePath, `${JSON.stringify(pkg, null, 4)}\n`);
    console.log(`Updated @eudiplo/cli version to ${version}`);
} catch (error) {
    console.error(`Failed to update CLI version: ${error.message}`);
    process.exit(1);
}