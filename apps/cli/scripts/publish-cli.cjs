#!/usr/bin/env node
/**
 * Publishes the EUDIPLO CLI package to npm.
 *
 * Usage: node apps/cli/scripts/publish-cli.cjs [tag]
 */

const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const cliDirectory = join(__dirname, "..");
const packageJsonPath = join(cliDirectory, "package.json");
const originalPackageJson = readFileSync(packageJsonPath, "utf8");
const tag = process.argv[2] ?? "latest";
const npmBinary = join(
    dirname(process.execPath),
    process.platform === "win32" ? "npm.cmd" : "npm",
);

const buildResult = spawnSync("pnpm", ["build:publish"], {
    cwd: cliDirectory,
    stdio: "inherit",
});

if (buildResult.error) {
    console.error(`Failed to build @eudiplo/cli: ${buildResult.error.message}`);
    process.exit(1);
}

if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
delete packageJson.dependencies?.["@eudiplo/config-format"];
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`);

let result;
try {
    result = spawnSync(
        npmBinary,
        [
            "publish",
            "--ignore-scripts",
            "--tag",
            tag,
            "--access",
            "public",
            "--provenance",
        ],
        {
            cwd: cliDirectory,
            stdio: "inherit",
        },
    );
} finally {
    writeFileSync(packageJsonPath, originalPackageJson);
}

if (result.error) {
    console.error(`Failed to publish @eudiplo/cli: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);