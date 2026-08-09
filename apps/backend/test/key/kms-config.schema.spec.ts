import Ajv from "ajv/dist/2020";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
    AwsKmsConfigSchema,
    CscKmsConfigSchema,
    DbKmsConfigSchema,
    HttpAuthBearerConfigSchema,
    HttpAuthMtlsConfigSchema,
    HttpAuthOauth2ConfigSchema,
    HttpKmsAuthConfigSchema,
    HttpKmsConfigSchema,
    KmsConfigSchema,
    KmsProviderConfigSchema,
    Pkcs11KmsConfigSchema,
    VaultKmsConfigSchema,
    parseResolvedKmsConfig,
} from "../../src/crypto/key/schemas/kms-config.schema";

function validDbProvider() {
    return {
        id: "db",
        type: "db" as const,
        description: "Default database provider",
    };
}

function validVaultProvider() {
    return {
        id: "vault",
        type: "vault" as const,
        description: "Vault",
        vaultUrl: "https://vault.example.com",
        vaultToken: "token",
    };
}

function validAwsProvider() {
    return {
        id: "aws",
        type: "aws-kms" as const,
        description: "AWS",
        region: "eu-west-1",
    };
}

function validPkcs11Provider() {
    return {
        id: "pkcs11",
        type: "pkcs11" as const,
        library: "/usr/lib/softhsm/libsofthsm2.so",
        slot: "0",
        pin: "123456",
    };
}

function validHttpProvider() {
    return {
        id: "http",
        type: "http" as const,
        baseUrl: "https://kms.example.com",
    };
}

function validCscProvider() {
    return {
        id: "csc",
        type: "csc" as const,
        baseUrl: "https://csc.example.com",
        tokenUrl: "https://csc.example.com/token",
        clientId: "client-id",
        clientSecret: "client-secret",
    };
}

function validKmsConfig() {
    return {
        defaultProvider: "vault",
        providers: [
            validDbProvider(),
            validVaultProvider(),
            validAwsProvider(),
            validPkcs11Provider(),
            validHttpProvider(),
            validCscProvider(),
        ],
    };
}

function expectValid(
    schema: { safeParse: (value: unknown) => { success: boolean } },
    value: unknown,
) {
    const result = schema.safeParse(value);
    expect(result.success).toBe(true);
}

function expectInvalid(
    schema: {
        safeParse: (value: unknown) => {
            success: boolean;
            error?: {
                issues: Array<{
                    path: Array<string | number>;
                    message: string;
                }>;
            };
        };
    },
    value: unknown,
    path: Array<string | number>,
) {
    const result = schema.safeParse(value);
    expect(result.success).toBe(false);
}

function assertNoDiscriminator(node: unknown) {
    if (!node || typeof node !== "object") {
        return;
    }

    if (Array.isArray(node)) {
        for (const item of node) {
            assertNoDiscriminator(item);
        }
        return;
    }

    const record = node as Record<string, unknown>;
    expect(record.discriminator).toBeUndefined();
    for (const value of Object.values(record)) {
        assertNoDiscriminator(value);
    }
}

describe("KMS Zod schemas", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it("accepts a valid configuration for every provider type", () => {
        expectValid(KmsConfigSchema, validKmsConfig());
        expectValid(DbKmsConfigSchema, validDbProvider());
        expectValid(VaultKmsConfigSchema, validVaultProvider());
        expectValid(AwsKmsConfigSchema, validAwsProvider());
        expectValid(Pkcs11KmsConfigSchema, validPkcs11Provider());
        expectValid(HttpKmsConfigSchema, validHttpProvider());
        expectValid(CscKmsConfigSchema, validCscProvider());
    });

    it("accepts every HTTP authentication variant", () => {
        expectValid(HttpKmsAuthConfigSchema, { type: "none" });
        expectValid(HttpKmsAuthConfigSchema, {
            type: "bearer",
            token: "token",
        });
        expectValid(HttpKmsAuthConfigSchema, {
            type: "oauth2-client-credentials",
            tokenUrl: "https://iam.example.com/token",
            clientId: "client-id",
            clientSecret: "client-secret",
            scope: "kms:sign kms:admin",
        });
        expectValid(HttpKmsAuthConfigSchema, {
            type: "mtls",
            certFile: "/etc/certs/client.crt",
            keyFile: "/etc/certs/client.key",
            caFile: "/etc/certs/ca.crt",
        });
    });

    it("rejects provider-specific fields on the wrong provider type", () => {
        expectInvalid(
            DbKmsConfigSchema,
            { ...validDbProvider(), vaultUrl: "https://vault.example.com" },
            ["vaultUrl"],
        );
        expectInvalid(
            VaultKmsConfigSchema,
            { ...validVaultProvider(), region: "eu-west-1" },
            ["region"],
        );
    });

    it("rejects unknown properties", () => {
        expectInvalid(
            KmsConfigSchema,
            { ...validKmsConfig(), unexpected: true },
            ["unexpected"],
        );
    });

    it("rejects unknown provider and auth types", () => {
        expectInvalid(KmsProviderConfigSchema, { id: "bad", type: "unknown" }, [
            "type",
        ]);
        expectInvalid(HttpKmsAuthConfigSchema, { type: "unknown" }, ["type"]);
    });

    it("rejects missing required HTTP auth fields", () => {
        expectInvalid(HttpAuthBearerConfigSchema, { type: "bearer" }, [
            "token",
        ]);
        expectInvalid(
            HttpAuthOauth2ConfigSchema,
            {
                type: "oauth2-client-credentials",
                tokenUrl: "https://iam.example.com/token",
            },
            ["clientId"],
        );
        expectInvalid(
            HttpAuthMtlsConfigSchema,
            { type: "mtls", certFile: "/etc/certs/client.crt" },
            ["keyFile"],
        );
    });

    it("rejects missing required provider fields", () => {
        expectInvalid(VaultKmsConfigSchema, { id: "vault", type: "vault" }, [
            "vaultUrl",
        ]);
        expectInvalid(AwsKmsConfigSchema, { id: "aws", type: "aws-kms" }, [
            "region",
        ]);
        expectInvalid(HttpKmsConfigSchema, { id: "http", type: "http" }, [
            "baseUrl",
        ]);
    });

    it("rejects duplicate provider ids", () => {
        const result = KmsConfigSchema.safeParse({
            defaultProvider: "vault",
            providers: [
                validDbProvider(),
                { ...validVaultProvider(), id: "db" },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.join(".") === "providers.1.id",
                ),
            ).toBe(true);
        }
    });

    it("rejects a defaultProvider that does not match an existing provider", () => {
        const result = KmsConfigSchema.safeParse({
            defaultProvider: "missing",
            providers: [validDbProvider(), validVaultProvider()],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.join(".") === "defaultProvider",
                ),
            ).toBe(true);
        }
    });

    it("accepts environment placeholders before and after expansion", () => {
        expectValid(KmsConfigSchema, {
            defaultProvider: "vault",
            providers: [
                {
                    id: "vault",
                    type: "vault",
                    vaultUrl: "${VAULT_URL}",
                    vaultToken: "${VAULT_TOKEN}",
                },
            ],
        });

        vi.stubEnv("VAULT_URL", "https://vault.example.com");
        vi.stubEnv("VAULT_TOKEN", "token");

        expect(
            parseResolvedKmsConfig({
                defaultProvider: "vault",
                providers: [
                    {
                        id: "vault",
                        type: "vault",
                        vaultUrl: "${VAULT_URL}",
                        vaultToken: "${VAULT_TOKEN}",
                    },
                ],
            }),
        ).toMatchObject({
            providers: [
                {
                    vaultUrl: "https://vault.example.com",
                    vaultToken: "token",
                },
            ],
        });
    });

    it("generates a standard Draft 2020-12 JSON Schema without OpenAPI discriminator keywords", () => {
        const generated = z.toJSONSchema(KmsConfigSchema, {
            target: "draft-2020-12",
        }) as Record<string, unknown>;

        assertNoDiscriminator(generated);

        const providerItems = generated.properties as
            | Record<string, any>
            | undefined;
        const oneOf = providerItems?.providers?.items?.oneOf as
            | Array<Record<string, any>>
            | undefined;
        expect(Array.isArray(oneOf)).toBe(true);
        expect(oneOf?.every((branch) => branch.properties?.type?.const)).toBe(
            true,
        );

        const ajv = new Ajv({ strict: true });
        const validate = ajv.compile(generated);

        expect(validate(validKmsConfig())).toBe(true);
        expect(
            validate({
                defaultProvider: "vault",
                providers: [validDbProvider(), { id: "vault", type: "vault" }],
            }),
        ).toBe(false);
    });
});
