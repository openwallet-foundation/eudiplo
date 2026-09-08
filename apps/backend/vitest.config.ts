import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "backend-unit",
        include: ["**/*.spec.ts"],
        exclude: ["**/*.e2e-spec.ts", "**/node_modules/**"],
        globals: false,
        root: fileURLToPath(new URL(".", import.meta.url)),
        setupFiles: [
            fileURLToPath(new URL("./vitest.setup.ts", import.meta.url)),
        ],
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage/unit",
            reporter: ["text", "lcov", "cobertura"],
            cleanOnRerun: false,
        },
    },
    plugins: [swc.vite()],
});
