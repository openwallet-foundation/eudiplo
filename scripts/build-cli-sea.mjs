import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";

const packageDirectory = new URL("../apps/cli/", import.meta.url);
const packagePath = fileURLToPath(packageDirectory);

rmSync(new URL("dist-sea", packageDirectory), { recursive: true, force: true });

const packageManagerExecutable = process.env.npm_execpath;
if (packageManagerExecutable) {
    execFileSync(process.execPath, [packageManagerExecutable, "run", "build:sea:bundle"], {
        cwd: packagePath,
        stdio: "inherit",
    });
} else {
    execFileSync("pnpm", ["run", "build:sea:bundle"], {
        cwd: packagePath,
        stdio: "inherit",
    });
}

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