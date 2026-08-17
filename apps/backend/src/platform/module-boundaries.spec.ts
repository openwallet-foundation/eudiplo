import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

const typescriptFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return typescriptFiles(path);
        return entry.name.endsWith(".ts") ? [path] : [];
    });

describe("backend module boundaries", () => {
    it("keeps shared code independent from application features", () => {
        const sharedRoot = resolve(sourceRoot, "shared");
        const violations: string[] = [];

        for (const file of typescriptFiles(sharedRoot)) {
            const source = readFileSync(file, "utf8");
            for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
                const target = resolve(dirname(file), match[1]);
                if (relative(sharedRoot, target).startsWith("..")) {
                    violations.push(
                        `${relative(sourceRoot, file)} -> ${relative(sourceRoot, target)}`,
                    );
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it("does not restore legacy catch-all locations", () => {
        const legacyDirectories = [
            "shared/trust",
            "shared/utils/config-import",
            "shared/utils/encryption",
            "shared/utils/logger",
            "shared/utils/webhook",
            "auth/tenant/entitites",
        ];

        expect(
            legacyDirectories.filter((directory) =>
                existsSync(resolve(sourceRoot, directory)),
            ),
        ).toEqual([]);
    });
});
