import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["**/oidf/*.e2e-spec.ts"],
        globals: true,
        root: "./",
        fileParallelism: false,        
        env: {
            MASTER_SECRET: "e2e-test-master-secret-do-not-use-in-production",
            AUTH_CLIENT_ID: "e2e-test-client",
            AUTH_CLIENT_SECRET: "e2e-test-secret",
            ENCRYPTION_KEY:
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            DB_SYNCHRONIZE: "true",
            DB_MIGRATIONS_RUN: "false",
        },
    },
    plugins: [swc.vite()],
});