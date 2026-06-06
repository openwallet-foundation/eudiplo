import { createHash } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { digest } from "@sd-jwt/crypto-nodejs";
import { SDJwtVcInstance, VerificationResult } from "@sd-jwt/sd-jwt-vc";
import { KbVerifier } from "@sd-jwt/types";
import { base64url, JWK } from "jose";
import { Span } from "nestjs-otel";
import { PinoLogger } from "nestjs-pino";
import { CryptoImplementationService } from "../../../../crypto/key/crypto-implementation/crypto-implementation.service";
import { VerifierOptions } from "../../../../shared/trust/types";
import { MatchedTrustedEntity } from "../../../../shared/trust/x509-validation.service";
import { ResolverService } from "../../../resolver/resolver.service";
import { CredentialChainValidationService } from "../credential-chain-validation.service";

@Injectable()
export class SdjwtvcverifierService {
    constructor(
        private readonly resolverService: ResolverService,
        private readonly cryptoService: CryptoImplementationService,
        private readonly chainValidation: CredentialChainValidationService,
        private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(SdjwtvcverifierService.name);
    }

    /**
     * Verifies an SD-JWT-VC credential.
     * Creates a fresh SDJwtVcInstance per verification to safely capture
     * the matched TrustedEntity for status list verification.
     *
     * If transaction data is provided in options, this method also validates
     * that the KB-JWT contains matching transaction_data_hashes.
     * See OID4VP spec Appendix B.3.3.1 for details.
     *
     * @param cred
     * @param options
     * @returns
     */
    @Span("sdjwt.verify")
    async verify(
        cred: string,
        options: VerifierOptions,
    ): Promise<VerificationResult> {
        // Closure to capture the matched TrustedEntity during verification
        let matchedEntity: MatchedTrustedEntity | null = null;

        // Create a fresh instance per verification to ensure thread safety
        const sdjwtInstance = new SDJwtVcInstance({
            hasher: digest,
            verifier: async (data: string, signature: string) => {
                const result = await this.verifyCredential(
                    data,
                    signature,
                    options,
                );
                matchedEntity = result.matchedEntity;
                return result.verified;
            },
            kbVerifier: (data, signature, payload) =>
                this.verifyKeyBindingJwt(
                    data,
                    signature,
                    payload,
                    options.keyBindingAudience,
                ),
            statusListFetcher: (uri: string) =>
                this.chainValidation.fetchStatusListJwt(uri),
            statusVerifier: (data: string, signature: string) => {
                // Verify status list JWT using the revocation cert from the same entity
                return this.verifyStatusList(
                    data,
                    signature,
                    options,
                    matchedEntity,
                );
            },
        });

        const result = await sdjwtInstance.verify(cred, options);

        // Validate transaction data hashes if transaction data was provided
        if (options.transactionData && options.transactionData.length > 0) {
            this.validateTransactionDataHashes(result, options.transactionData);
        }

        return result;
    }

    /**
     * Validates that the KB-JWT contains transaction_data_hashes that match
     * the SHA-256 hashes of the provided transaction data.
     *
     * According to OID4VP spec Appendix B.3.3.1:
     * - transaction_data_hashes: A non-empty array of strings where each element
     *   is a base64url-encoded hash calculated over the transaction data string
     *   (base64url decoding is NOT performed before hashing).
     * - The hash function defaults to SHA-256 unless transaction_data_hashes_alg
     *   specifies otherwise.
     *
     * @param result The verification result containing the KB-JWT payload
     * @param transactionData The base64url-encoded transaction data strings from the request
     * @throws BadRequestException if validation fails
     */
    private validateTransactionDataHashes(
        result: VerificationResult,
        transactionData: string[],
    ): void {
        const kbPayload = result.kb?.payload as
            | (Record<string, unknown> & {
                  transaction_data_hashes?: string[];
                  transaction_data_hashes_alg?: string;
              })
            | undefined;

        if (!kbPayload) {
            throw new BadRequestException(
                "Transaction data was provided but KB-JWT is missing",
            );
        }

        const receivedHashes = kbPayload.transaction_data_hashes;

        if (!receivedHashes || !Array.isArray(receivedHashes)) {
            throw new BadRequestException(
                "Transaction data was provided but KB-JWT does not contain transaction_data_hashes",
            );
        }

        if (receivedHashes.length !== transactionData.length) {
            throw new BadRequestException(
                `Transaction data hash count mismatch: expected ${transactionData.length}, received ${receivedHashes.length}`,
            );
        }

        // Determine hash algorithm - defaults to sha-256 per spec
        const hashAlg = kbPayload.transaction_data_hashes_alg ?? "sha-256";

        // Map OID4VP hash algorithm names to Node.js crypto names
        const algoMap: Record<string, string> = {
            "sha-256": "sha256",
            "sha-384": "sha384",
            "sha-512": "sha512",
        };

        const nodeAlgo = algoMap[hashAlg];
        if (!nodeAlgo) {
            throw new BadRequestException(
                `Unsupported transaction_data_hashes_alg: ${hashAlg}`,
            );
        }

        // Compute expected hashes and compare
        // Per spec: hash is computed over the string as-is (no base64url decoding)
        for (let i = 0; i < transactionData.length; i++) {
            const expectedHash = base64url.encode(
                createHash(nodeAlgo).update(transactionData[i]).digest(),
            );

            if (receivedHashes[i] !== expectedHash) {
                this.logger.debug(
                    `Transaction data hash mismatch at index ${i}: expected ${expectedHash}, received ${receivedHashes[i]}`,
                );
                throw new BadRequestException(
                    `Transaction data hash mismatch at index ${i}`,
                );
            }
        }

        this.logger.debug(
            `Transaction data hashes validated successfully (${transactionData.length} entries)`,
        );
    }

    /**
     * Verifies the SD-JWT-VC credential signature and trust chain.
     * Returns both the verification result and the matched TrustedEntity.
     *
     * data = "<b64url(header)>.<b64url(payload)>"
     * signature = "<b64url(signature)>"
     */
    private async verifyCredential(
        data: string,
        signature: string,
        options: VerifierOptions,
    ): Promise<{
        verified: boolean;
        matchedEntity: MatchedTrustedEntity | null;
    }> {
        try {
            // 1) Verify SD-JWT signature first (fast fail)
            const [headerB64] = data.split(".");
            const headerJson = Buffer.from(
                headerB64.replaceAll("-", "+").replaceAll("_", "/"),
                "base64",
            ).toString("utf8");
            const header = JSON.parse(headerJson);
            const publicKey =
                await this.resolverService.resolvePublicKey(header);
            const crypto = this.cryptoService.getCryptoFromJwk(publicKey);
            const verifier = await crypto.getVerifier(publicKey);

            const sigOk = await verifier(data, signature).catch((e) => {
                this.logger.debug(
                    `SD-JWT signature invalid: ${e?.message ?? e}`,
                );
                return false;
            });
            if (!sigOk) return { verified: false, matchedEntity: null };

            // 2) Validate certificate chain using shared service
            const x5c: string[] | undefined = header?.x5c;
            const chainResult = await this.chainValidation.validateChain(
                x5c ?? [],
                options.trustListSource,
                {
                    requireX5c: options?.policy.requireX5c,
                    pinnedCertMode: options?.policy.pinnedCertMode ?? "leaf",
                    serviceTypeFilter: "/Issuance",
                    federationTrustSource: options.federationTrustSource,
                },
            );

            if (!chainResult.verified) {
                if (chainResult.errorDetails) {
                    this.logger.warn(
                        `Certificate chain validation failed: ${chainResult.errorDetails}`,
                    );
                }
                return { verified: false, matchedEntity: null };
            }

            return { verified: true, matchedEntity: chainResult.matchedEntity };
        } catch (e: any) {
            this.logger.error(`Error in verifier: ${e?.message ?? e}`);
            return { verified: false, matchedEntity: null };
        }
    }

    /**
     * Verifies the status list JWT using the revocation certificate from
     * the same TrustedEntity that issued the credential.
     *
     * This ensures that the status list is signed by the authorized revocation
     * service of the same entity that issued the credential.
     *
     * @param data The JWT data to verify (header.payload)
     * @param signature The JWT signature
     * @param options The verification options
     * @param matchedEntity The TrustedEntity that matched during credential verification
     * @returns true if the status list is validly signed by the entity's revocation cert
     */
    private async verifyStatusList(
        data: string,
        signature: string,
        options: VerifierOptions,
        matchedEntity: MatchedTrustedEntity | null,
    ): Promise<boolean> {
        try {
            // 1) Verify the signature of the status list JWT
            const [headerB64] = data.split(".");
            const headerJson = Buffer.from(
                headerB64.replaceAll("-", "+").replaceAll("_", "/"),
                "base64",
            ).toString("utf8");
            const header = JSON.parse(headerJson);
            const publicKey =
                await this.resolverService.resolvePublicKey(header);
            const crypto = this.cryptoService.getCryptoFromJwk(publicKey);
            const verifier = await crypto.getVerifier(publicKey);

            const sigOk = await verifier(data, signature)
                .then(() => true)
                .catch((e) => {
                    this.logger.debug(
                        `Status list JWT signature invalid: ${e?.message ?? e}`,
                    );
                    return false;
                });
            if (!sigOk) return false;

            // 2) Verify status list certificate chain using shared service
            const x5c: string[] | undefined = header?.x5c;
            return await this.chainValidation.verifyStatusListSignature(
                x5c,
                matchedEntity,
                options.trustListSource,
                {
                    pinnedCertMode: options.policy.pinnedCertMode ?? "leaf",
                    federationTrustSource: options.federationTrustSource,
                },
            );
        } catch (e: any) {
            this.logger.error(
                `Error verifying status list: ${e?.message ?? e}`,
            );
            return false;
        }
    }

    /**
     * Verifier for keybindings. It will verify the signature of the keybinding and return true if it is valid.
     * @param data
     * @param signature
     * @param payload
     * @returns
     */
    private readonly kbVerifier: KbVerifier = async (
        data,
        signature,
        payload,
    ) => {
        return this.verifyKeyBindingJwt(data, signature, payload);
    };

    private async verifyKeyBindingJwt(
        data: string,
        signature: string,
        payload: Record<string, unknown>,
        expectedAudience?: string,
    ): Promise<boolean> {
        if (!payload.cnf) {
            throw new Error("No cnf found in the payload");
        }

        const MAX_FUTURE_IAT_SKEW_SECONDS = 60;
        const MAX_PAST_IAT_AGE_SECONDS = 300;
        const [, kbPayloadB64] = data.split(".");
        if (!kbPayloadB64) {
            throw new Error("Invalid key binding JWT payload");
        }

        const kbPayloadJson = Buffer.from(kbPayloadB64, "base64url").toString(
            "utf8",
        );
        const kbPayload = JSON.parse(kbPayloadJson) as {
            aud?: unknown;
            iat?: unknown;
        };

        if (
            typeof kbPayload.iat !== "number" ||
            !Number.isFinite(kbPayload.iat)
        ) {
            throw new BadRequestException("Invalid key binding JWT iat");
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (kbPayload.iat > nowInSeconds + MAX_FUTURE_IAT_SKEW_SECONDS) {
            this.logger.debug(
                {
                    kbJwtIat: kbPayload.iat,
                    nowInSeconds,
                    maxSkewSeconds: MAX_FUTURE_IAT_SKEW_SECONDS,
                },
                "KB-JWT iat is in the future",
            );
            throw new BadRequestException("Invalid key binding JWT iat");
        }

        if (nowInSeconds - kbPayload.iat > MAX_PAST_IAT_AGE_SECONDS) {
            this.logger.debug(
                {
                    kbJwtIat: kbPayload.iat,
                    nowInSeconds,
                    maxAgeSeconds: MAX_PAST_IAT_AGE_SECONDS,
                },
                "KB-JWT iat is too old",
            );
            throw new BadRequestException("Invalid key binding JWT iat");
        }

        if (expectedAudience) {
            if (kbPayload.aud !== expectedAudience) {
                this.logger.debug(
                    {
                        expectedAudience,
                        actualAudience: kbPayload.aud,
                    },
                    "KB-JWT audience mismatch",
                );
                throw new BadRequestException(
                    "Invalid key binding JWT audience",
                );
            }
        }

        const jwk: JWK = (payload.cnf as any).jwk;
        const crypto = this.cryptoService.getCryptoFromJwk(jwk);
        const verifier = await crypto.getVerifier(jwk);
        return verifier(data, signature);
    }
}
