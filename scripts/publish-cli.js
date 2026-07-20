#!/usr/bin/env node
/**
 * Publishes the EUDIPLO CLI package to npm.
 *
 * Usage: node scripts/publish-cli.js [tag]
 */

const { spawnSync } = require("node:child_process");
const { dirname, join } = require("node:path");

const cliDirectory = join(__dirname, "../apps/cli");
const tag = process.argv[2] ?? "latest";
const npmBinary = join(
    dirname(process.execPath),
    process.platform === "win32" ? "npm.cmd" : "npm",
);

const result = spawnSync(
    npmBinary,
    ["publish", "--tag", tag, "--access", "public", "--provenance"],
    {
        cwd: cliDirectory,
        stdio: "inherit",
    },
);

if (result.error) {
    console.error(`Failed to publish @eudiplo/cli: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);