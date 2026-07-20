import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

const packageDirectory = new URL("../apps/cli/", import.meta.url);
const packagePath = fileURLToPath(packageDirectory);

rmSync(new URL("dist-sea", packageDirectory), { recursive: true, force: true });

const pnpmExecutable = process.env.npm_execpath;
if (!pnpmExecutable) {
    throw new Error("pnpm executable path is not available.");
}

execFileSync(process.execPath, [pnpmExecutable, "build:sea:bundle"], {
    cwd: packagePath,
    stdio: "inherit",
});

execFileSync(process.execPath, ["--build-sea", "sea-config.json"], {
    cwd: packagePath,
    stdio: "inherit",
});

if (platform === "darwin") {
    execFileSync("/usr/bin/codesign", ["--sign", "-", "dist-sea/eudiplo"], {
        cwd: packagePath,
        stdio: "inherit",
    });
}