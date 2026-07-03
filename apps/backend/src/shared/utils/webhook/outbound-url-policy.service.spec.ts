import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
    lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { OutboundUrlPolicyService } from "./outbound-url-policy.service";

type ConfigValue = string | boolean | undefined;

describe("OutboundUrlPolicyService", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NODE_ENV = originalNodeEnv;
    });

    function createService(config: Record<string, ConfigValue> = {}) {
        const configService = {
            get: vi.fn((key: string) => config[key]),
        };

        return {
            service: new OutboundUrlPolicyService(configService as any),
            configService,
        };
    }

    it("rejects invalid URL values", async () => {
        const { service } = createService();

        await expect(service.assertSafeUrl("not-a-url")).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it("rejects HTTP in production by default", async () => {
        process.env.NODE_ENV = "production";
        const { service } = createService();

        await expect(
            service.assertSafeUrl("http://example.com/webhook"),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("allows HTTP in non-production by default", async () => {
        process.env.NODE_ENV = "development";
        const { service } = createService();

        await expect(
            service.assertSafeUrl("http://example.com/webhook"),
        ).resolves.toBeUndefined();
    });

    it("rejects localhost targets", async () => {
        process.env.NODE_ENV = "production";
        const { service } = createService();

        await expect(
            service.assertSafeUrl("https://localhost/internal"),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects direct private IP targets", async () => {
        process.env.NODE_ENV = "production";
        const { service } = createService();

        await expect(
            service.assertSafeUrl("https://10.0.0.1/internal"),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects hostnames that resolve to private IPs", async () => {
        process.env.NODE_ENV = "production";
        vi.mocked(lookup).mockResolvedValue([
            { address: "127.0.0.1", family: 4 },
        ]);

        const { service } = createService();

        await expect(
            service.assertSafeUrl("https://issuer.example/webhook"),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("allows configured host allowlist including subdomains", async () => {
        process.env.NODE_ENV = "production";
        vi.mocked(lookup).mockResolvedValue([
            { address: "93.184.216.34", family: 4 },
        ]);

        const { service } = createService({
            OUTBOUND_URL_ALLOWED_HOSTS: "example.com",
        });

        await expect(
            service.assertSafeUrl("https://hooks.example.com/webhook"),
        ).resolves.toBeUndefined();
    });

    it("rejects hosts outside configured allowlist", async () => {
        process.env.NODE_ENV = "production";
        const { service } = createService({
            OUTBOUND_URL_ALLOWED_HOSTS: "example.com",
        });

        await expect(
            service.assertSafeUrl("https://attacker.test/webhook"),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("allows private network targets when explicitly enabled", async () => {
        process.env.NODE_ENV = "production";
        const { service } = createService({
            OUTBOUND_URL_ALLOW_PRIVATE_NETWORK: true,
        });

        await expect(
            service.assertSafeUrl("https://10.1.2.3/internal"),
        ).resolves.toBeUndefined();
    });
});
