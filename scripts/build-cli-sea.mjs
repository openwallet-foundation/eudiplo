import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arch, platform } from "node:process";
import { fileURLToPath } from "node:url";

const packageDirectory = new URL("../apps/cli/", import.meta.url);
const packagePath = fileURLToPath(packageDirectory);
const distSeaDirectory = join(packagePath, "dist-sea");
const baseSeaConfigPath = join(packagePath, "sea-config.json");
const generatedSeaConfigPath = join(distSeaDirectory, "sea-config.generated.json");

function ensureBundle() {
    const packageManagerExecutable = process.env.npm_execpath;

    if (packageManagerExecutable) {
        execFileSync(process.execPath, [packageManagerExecutable, "run", "build:sea:bundle"], {
            cwd: packagePath,
            stdio: "inherit",
        });
        return;
    }

    execFileSync("pnpm", ["run", "build:sea:bundle"], {
        cwd: packagePath,
        stdio: "inherit",
    });
}

function detectBuildTarget() {
    const byPlatform = {
        linux: {
            x64: "linux-x64",
            arm64: "linux-arm64",
        },
        darwin: {
            arm64: "macos-arm64",
        },
        win32: {
            x64: "windows-x64",
        },
    };

    const target = byPlatform[platform]?.[arch];
    if (!target) {
        throw new Error(
            `Unsupported platform/architecture for SEA build: ${platform}/${arch}. Supported targets: linux/x64, linux/arm64, darwin/arm64, win32/x64.`,
        );
    }

    return target;
}

function createEffectiveSeaConfig() {
    const baseConfig = JSON.parse(readFileSync(baseSeaConfigPath, "utf-8"));
    const outputFilename = platform === "win32" ? "eudiplo.exe" : "eudiplo";
    const generatedConfig = {
        ...baseConfig,
        main: "dist-sea/index.js",
        output: `dist-sea/${outputFilename}`,
        assets: {
            "templates/docker-compose.yml": "templates/docker-compose.yml",
        },
    };

    writeFileSync(generatedSeaConfigPath, `${JSON.stringify(generatedConfig, null, 4)}\n`);
    return outputFilename;
}

function cleanup() {
    rmSync(generatedSeaConfigPath, { force: true });
}

try {
    const target = detectBuildTarget();
    rmSync(distSeaDirectory, { recursive: true, force: true });
    mkdirSync(distSeaDirectory, { recursive: true });

    ensureBundle();

    const outputFilename = createEffectiveSeaConfig();
    const outputPath = join(distSeaDirectory, outputFilename);

    console.log(`Building SEA for ${target} (${platform}/${arch}) -> ${outputPath}`);

    execFileSync(process.execPath, ["--build-sea", generatedSeaConfigPath], {
        cwd: packagePath,
        stdio: "inherit",
    });

    if (platform === "darwin") {
        execFileSync("/usr/bin/codesign", ["--sign", "-", outputPath], {
            cwd: packagePath,
            stdio: "inherit",
        });
    }

    console.log(`SEA build complete: ${outputPath}`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SEA build failed: ${message}`);
    process.exit(1);
} finally {
    cleanup();
}
