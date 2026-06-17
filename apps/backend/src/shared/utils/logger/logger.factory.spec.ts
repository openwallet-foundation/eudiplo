import { describe, expect, it } from "vitest";
import { createLoggerOptions } from "./logger.factory";

describe("createLoggerOptions", () => {
    const configValues: Record<string, unknown> = {
        LOG_ENABLE_HTTP_LOGGER: true,
        LOG_LEVEL: "debug",
        LOG_TO_FILE: false,
        LOG_FILE_PATH: "./logs/backend.log",
        OTEL_SDK_DISABLED: true,
        OTEL_SERVICE_NAME: "eudiplo-backend",
        VERSION: "test",
    };

    const configService = {
        getOrThrow: (key: string) => configValues[key],
        get: (key: string, defaultValue?: unknown) =>
            configValues[key] ?? defaultValue,
    } as any;

    it("includes method and route in HTTP auto log messages", () => {
        const options = createLoggerOptions(configService).pinoHttp;
        const req = {
            method: "GET",
            url: "/fallback-route",
            originalUrl:
                "/.well-known/openid-credential-issuer/issuers/playground",
        };
        const res = { statusCode: 200 };

        expect(options.customReceivedMessage(req)).toBe(
            "GET /.well-known/openid-credential-issuer/issuers/playground received",
        );
        expect(options.customSuccessMessage(req, res, 12)).toBe(
            "GET /.well-known/openid-credential-issuer/issuers/playground -> 200 (12ms)",
        );
    });

    it("formats HTTP error messages with route and status", () => {
        const options = createLoggerOptions(configService).pinoHttp;
        const req = {
            method: "POST",
            url: "/issuer/offer",
        };
        const res = { statusCode: 500 };
        const error = new Error("boom");

        expect(options.customErrorMessage(req, res, error)).toBe(
            "POST /issuer/offer -> 500 Error: boom",
        );
    });
});
