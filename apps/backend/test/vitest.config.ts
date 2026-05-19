import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["**/*.e2e-spec.ts"],
        exclude: [],
        globals: true,
        root: "./",
        fileParallelism: false,
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage/e2e",
            reporter: ["text", "lcov"],
            cleanOnRerun: false,
        },
        reporters: ["default", "junit"],
        outputFile: {
            junit: "../test-report.junit.xml",
        },
        env: {
            // Required environment variables for E2E tests
            MASTER_SECRET: "e2e-test-master-secret-do-not-use-in-production",
            AUTH_CLIENT_ID: "e2e-test-client",
            AUTH_CLIENT_SECRET: "e2e-test-secret",
            ENCRYPTION_KEY:
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            // Use synchronize for tests (fresh DB each run), skip migrations
            DB_SYNCHRONIZE: "true",
            DB_MIGRATIONS_RUN: "false",
        },
    },
    plugins: [swc.vite()],
});
