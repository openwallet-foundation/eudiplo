import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    test: {
        projects: [
            `${repositoryRoot}/apps/backend/vitest.config.ts`,
            `${repositoryRoot}/apps/backend/test/vitest.config.ts`,
            {
                test: {
                    include: ["apps/cli/test/**/*.test.ts"],
                    name: "cli",
                    root: repositoryRoot,
                },
            },
        ],
    },
});