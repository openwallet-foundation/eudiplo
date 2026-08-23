import { describe, expect, it } from "vitest";
import { ConfigBundleService } from "./config-bundle.service";
import { ConfigResourceRegistry } from "./config-resource.registry";
import type {
    ConfigBundleRequirement,
    ConfigResourceKind,
} from "./config-resource.types";

describe("ConfigBundleService secret handling", () => {
    const service = Object.create(
        ConfigBundleService.prototype,
    ) as ConfigBundleService;
    Reflect.set(service, "registry", new ConfigResourceRegistry());

    it("replaces every registered KMS credential with a requirement", () => {
        const requirements: ConfigBundleRequirement[] = [];
        const redact = Reflect.get(service, "redact") as (
            kind: ConfigResourceKind,
            id: string,
            value: unknown,
            requirements: ConfigBundleRequirement[],
        ) => unknown;
        const output = redact.call(
            service,
            "KmsConfig",
            "kms",
            {
                providers: [
                    {
                        id: "vault",
                        vaultToken: "vault-secret",
                        secretAccessKey: "aws-secret",
                        pin: "pkcs11-secret",
                        clientSecret: "csc-client-secret",
                        sad: "csc-sad",
                        authorizeAuthData: [{ name: "otp", value: "123456" }],
                        auth: {
                            token: "bearer-secret",
                            clientSecret: "oauth-secret",
                        },
                    },
                ],
            },
            requirements,
        ) as Record<string, unknown>;

        expect(JSON.stringify(output)).not.toContain("vault-secret");
        expect(JSON.stringify(output)).not.toContain("aws-secret");
        expect(JSON.stringify(output)).not.toContain("pkcs11-secret");
        expect(JSON.stringify(output)).not.toContain("csc-client-secret");
        expect(JSON.stringify(output)).not.toContain("csc-sad");
        expect(JSON.stringify(output)).not.toContain("123456");
        expect(JSON.stringify(output)).not.toContain("bearer-secret");
        expect(JSON.stringify(output)).not.toContain("oauth-secret");
        expect(requirements).toHaveLength(8);
        expect(
            requirements.every(({ code }) => code === "SECRET_REQUIRED"),
        ).toBe(true);
    });

    it("removes private parameters from exported public JWKs", () => {
        const toPublicJwk = Reflect.get(service, "toPublicJwk") as (
            value: unknown,
        ) => Record<string, unknown>;

        expect(
            toPublicJwk.call(service, {
                kty: "EC",
                crv: "P-256",
                x: "public-x",
                y: "public-y",
                d: "private-d",
                k: "private-k",
            }),
        ).toEqual({
            kty: "EC",
            crv: "P-256",
            x: "public-x",
            y: "public-y",
        });
    });
});
