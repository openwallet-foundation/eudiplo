import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { IsString } from "class-validator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KmsConfigDto } from "../../src/crypto/key/dto/kms-config.dto";
import { createHybridValidationPipe } from "../../src/shared/common/pipes/hybrid-validation.pipe";

class LegacyDto {
    @IsString()
    name!: string;
}

describe("HybridValidationPipe", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it("preserves Zod DTO properties instead of stripping them", async () => {
        const pipe = createHybridValidationPipe();
        const value = await pipe.transform(
            {
                defaultProvider: "vault",
                providers: [
                    {
                        id: "vault",
                        type: "vault",
                        vaultUrl: "https://vault.example.com",
                        vaultToken: "token",
                    },
                ],
            },
            { type: "body", metatype: KmsConfigDto } as any,
        );

        expect(value).toMatchObject({
            defaultProvider: "vault",
            providers: [
                {
                    id: "vault",
                    type: "vault",
                    vaultUrl: "https://vault.example.com",
                    vaultToken: "token",
                },
            ],
        });
    });

    it("keeps legacy class-validator DTO validation working", async () => {
        const pipe = createHybridValidationPipe();

        await expect(
            pipe.transform({ name: 123 }, {
                type: "body",
                metatype: LegacyDto,
            } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects invalid KMS payloads with a validation error", async () => {
        const pipe = createHybridValidationPipe();

        try {
            await pipe.transform(
                {
                    defaultProvider: "vault",
                    providers: [
                        {
                            id: "vault",
                            type: "vault",
                        },
                    ],
                },
                { type: "body", metatype: KmsConfigDto } as any,
            );
            expect.unreachable("expected KMS validation to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect(error).toMatchObject({ status: 400 });
        }
    });
});
