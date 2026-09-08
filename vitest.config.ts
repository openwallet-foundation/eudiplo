import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            "./apps/backend/vitest.config.ts",
            "./apps/backend/test/vitest.config.ts",
            {
                test: {
                    include: ["apps/cli/test/**/*.test.ts"],
                    name: "cli",
                    root: "./",
                },
            },
        ],
    },
});