import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
    input: "http://localhost:3001/api-json",
    output: {
        path: "./src/registrar/generated",
        postProcess: ["biome:format"],
    },
    plugins: [
        {
            name: "@hey-api/client-fetch",
        },
        "@hey-api/schemas",
        {
            name: "@hey-api/sdk",
        },
        {
            enums: "javascript",
            name: "@hey-api/typescript",
        },
    ],
});
