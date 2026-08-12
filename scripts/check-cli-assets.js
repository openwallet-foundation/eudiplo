#!/usr/bin/env node
/**
 * Ensures CLI-packaged deployment assets stay in sync with the canonical repo
 * deployment files.
 */

const { readFileSync, readdirSync } = require("node:fs");
const { join, relative } = require("node:path");

const canonicalComposePath = join(
    __dirname,
    "../deployment/docker-compose/docker-compose.yml",
);
const cliComposePath = join(__dirname, "../apps/cli/templates/docker-compose.yml");
const canonicalDemoDirectory = join(__dirname, "../assets/config/demo");
const cliDemoDirectory = join(__dirname, "../apps/cli/templates/demo-config");

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

const canonicalDemoFiles = collectFilesRecursive(canonicalDemoDirectory);
const cliDemoFiles = collectFilesRecursive(cliDemoDirectory);

if (JSON.stringify(canonicalDemoFiles) !== JSON.stringify(cliDemoFiles)) {
    console.error("apps/cli/templates/demo-config is out of sync with assets/config/demo");
    reportMissingAndExtra(canonicalDemoFiles, cliDemoFiles);
    process.exit(1);
}

for (const relativePath of canonicalDemoFiles) {
    const canonicalFilePath = join(canonicalDemoDirectory, relativePath);
    const cliFilePath = join(cliDemoDirectory, relativePath);
    const canonicalContents = readFileSync(canonicalFilePath, "utf8");
    const cliContents = readFileSync(cliFilePath, "utf8");
    if (canonicalContents !== cliContents) {
        console.error(
            `apps/cli/templates/demo-config/${relativePath} differs from assets/config/demo/${relativePath}`,
        );
        process.exit(1);
    }
}

console.log("CLI deployment assets are in sync.");

function collectFilesRecursive(root) {
    const files = [];

    function walk(current) {
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const absolutePath = join(current, entry.name);
            if (entry.isDirectory()) {
                walk(absolutePath);
                continue;
            }

            files.push(relative(root, absolutePath).replaceAll("\\", "/"));
        }
    }

    walk(root);
    files.sort((left, right) => left.localeCompare(right));
    return files;
}

function reportMissingAndExtra(expectedFiles, actualFiles) {
    const expectedSet = new Set(expectedFiles);
    const actualSet = new Set(actualFiles);

    for (const expected of expectedFiles) {
        if (!actualSet.has(expected)) {
            console.error(`Missing demo asset: ${expected}`);
        }
    }
    for (const actual of actualFiles) {
        if (!expectedSet.has(actual)) {
            console.error(`Unexpected demo asset: ${actual}`);
        }
    }
}