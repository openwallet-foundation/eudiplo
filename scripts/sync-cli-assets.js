#!/usr/bin/env node
/**
 * Synchronizes CLI-bundled assets from canonical repository sources.
 *
 * Canonical sources:
 * - deployment/docker-compose/docker-compose.yml
 * - assets/config/demo/**
 */

const { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { join, relative } = require("node:path");

const repoRoot = join(__dirname, "..");
const canonicalComposePath = join(repoRoot, "deployment/docker-compose/docker-compose.yml");
const cliComposePath = join(repoRoot, "apps/cli/templates/docker-compose.yml");
const canonicalDemoDirectory = join(repoRoot, "assets/config/demo");
const cliDemoDirectory = join(repoRoot, "apps/cli/templates/demo-config");
const cliDemoManifestPath = join(repoRoot, "apps/cli/templates/demo-config.manifest.json");

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

mkdirSync(join(repoRoot, "apps/cli/templates"), { recursive: true });

const canonicalCompose = readFileSync(canonicalComposePath, "utf8");
writeFileSync(cliComposePath, canonicalCompose);

rmSync(cliDemoDirectory, { recursive: true, force: true });
mkdirSync(cliDemoDirectory, { recursive: true });
cpSync(canonicalDemoDirectory, cliDemoDirectory, { recursive: true });

const manifest = collectFilesRecursive(cliDemoDirectory);
writeFileSync(cliDemoManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("CLI assets synchronized from canonical sources.");
