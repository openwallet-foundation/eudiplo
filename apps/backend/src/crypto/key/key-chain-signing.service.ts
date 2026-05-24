import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Signer } from "@sd-jwt/types";
import {
    exportSPKI,
    importJWK,
    type JWK,
    type JWSHeaderParameters,
    type JWTPayload,
} from "jose";
import { Span } from "nestjs-otel";
import { Repository } from "typeorm";
import { KeyChainEntity, KeyUsage } from "./entities/key-chain.entity";
import type { KmsAdapter, KmsKeyRef, KmsSigningAlg } from "./kms/kms-adapter";
import { KmsProviderRegistry } from "./kms/kms-provider.registry";

function base64url(input: string): string {
    return Buffer.from(input, "utf8").toString("base64url");
}

/**
 * Handles all signing and public-key export operations for key chains.
 *
 * Keeps the signing concern isolated from the CRUD and import logic
 * in {@link KeyChainService}.
 */
@Injectable()
export class KeyChainSigningService {
    constructor(
        @InjectRepository(KeyChainEntity)
        private readonly keyChainRepository: Repository<KeyChainEntity>,
        private readonly kmsRegistry: KmsProviderRegistry,
    ) {}

    async signer(tenantId: string, keyId?: string): Promise<Signer> {
        const keyChain = keyId
            ? await this.getKeyChain(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const adapter = this.kmsRegistry.resolve(keyChain.kmsProvider);
        const ref = this.refFromEntity(keyChain);

        return async (data: string): Promise<string> => {
            const signature = await adapter.sign(
                ref,
                new TextEncoder().encode(data),
            );
            return Buffer.from(signature).toString("base64url");
        };
    }

    @Span("keychain.signJWT")
    async signJWT(
        payload: JWTPayload,
        header: JWSHeaderParameters,
        tenantId: string,
        keyId?: string,
    ): Promise<string> {
        const keyChain = keyId
            ? await this.getKeyChain(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const adapter = this.kmsRegistry.resolve(keyChain.kmsProvider);
        const ref = this.refFromEntity(keyChain);

        const { b64: _b64, ...compatibleHeader } = header;
        const jwtHeader = {
            ...compatibleHeader,
            alg: header.alg || "ES256",
            kid: keyChain.activeJwk.kid,
        };

        const headerB64 = base64url(JSON.stringify(jwtHeader));
        const payloadB64 = base64url(JSON.stringify(payload));
        const signingInput = `${headerB64}.${payloadB64}`;
        const sig = await adapter.sign(
            ref,
            new TextEncoder().encode(signingInput),
        );
        const sigB64 = Buffer.from(sig).toString("base64url");
        return `${signingInput}.${sigB64}`;
    }

    getPublicKey(type: "jwk", tenantId: string, keyId?: string): Promise<JWK>;
    getPublicKey(
        type: "pem",
        tenantId: string,
        keyId?: string,
    ): Promise<string>;
    async getPublicKey(
        type: "pem" | "jwk",
        tenantId: string,
        keyId?: string,
    ): Promise<JWK | string> {
        const keyChain = keyId
            ? await this.getKeyChain(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const publicJwk = this.getPublicJwk(keyChain.activeJwk);

        if (type === "jwk") {
            return publicJwk;
        }

        const publicKey = await importJWK(publicJwk, "ES256");
        return exportSPKI(publicKey as CryptoKey);
    }

    async getKid(tenantId: string): Promise<string> {
        const keyChain = await this.getFirstKeyChain(tenantId);
        return keyChain.id;
    }

    private async getKeyChain(
        tenantId: string,
        id: string,
    ): Promise<KeyChainEntity> {
        const keyChain = await this.keyChainRepository.findOne({
            where: { tenantId, id },
        });
        if (!keyChain) {
            throw new NotFoundException(`Key chain ${id} not found`);
        }
        return keyChain;
    }

    private async getFirstKeyChain(tenantId: string): Promise<KeyChainEntity> {
        const keyChain = await this.keyChainRepository.findOne({
            where: { tenantId, usage: KeyUsage.Sign },
        });
        if (!keyChain) {
            throw new NotFoundException(
                `No key chain found for tenant ${tenantId}`,
            );
        }
        return keyChain;
    }

    private refFromEntity(keyChain: KeyChainEntity): KmsKeyRef {
        const adapter = this.kmsRegistry.resolve(keyChain.kmsProvider);
        return this.refForStoredKey(
            adapter,
            keyChain.activeJwk,
            keyChain.externalKeyId ?? undefined,
        );
    }

    private refForStoredKey(
        adapter: KmsAdapter,
        storedJwk: JWK,
        externalKeyId?: string,
    ): KmsKeyRef {
        const alg =
            (storedJwk.alg as KmsSigningAlg | undefined) ??
            adapter.capabilities.defaultAlg;
        if (adapter.type === "db") {
            const publicJwk = this.getPublicJwk(storedJwk);
            return { privateJwk: storedJwk, publicJwk, alg };
        }
        return {
            externalKeyId: externalKeyId ?? storedJwk.kid,
            publicJwk: storedJwk,
            alg,
        };
    }

    private getPublicJwk(jwk: JWK): JWK {
        const { d, p, q, dp, dq, qi, k, ...publicJwk } = jwk as Record<
            string,
            unknown
        >;
        return publicJwk;
    }
}
