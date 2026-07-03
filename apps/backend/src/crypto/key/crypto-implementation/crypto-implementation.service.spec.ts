import { describe, expect, test } from "vitest";
import { ConfigService } from "@nestjs/config";
import { CredentialFormat } from "../../../issuer/configuration/credentials/entities/credential.entity";
import { CryptoImplementationService } from "./crypto-implementation.service";

describe("CryptoImplementationService", () => {
    test("returns both classic and fully-specified COSE alg values for mDOC", () => {
        const configService = {
            get: () => "ES256",
        } as unknown as ConfigService;
        const service = new CryptoImplementationService(configService);

        const algs = service.getAlgs(CredentialFormat.MSO_MDOC);

        expect(algs).toEqual(expect.arrayContaining([-7, -9]));
    });

    test("returns JOSE alg values for SD-JWT VC", () => {
        const configService = {
            get: () => "ES256",
        } as unknown as ConfigService;
        const service = new CryptoImplementationService(configService);

        const algs = service.getAlgs(CredentialFormat.SD_JWT_VC);

        expect(algs).toContain("ES256");
    });
});
