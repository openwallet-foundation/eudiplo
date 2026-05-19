import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jwaSignatureAlgorithmToFullySpecifiedCoseAlgorithm } from "@openid4vc/oauth2";
import { ES256 } from "@sd-jwt/crypto-nodejs";
import { CredentialFormat } from "../../../issuer/configuration/credentials/entities/credential.entity";
import { CryptoImplementation } from "./crypto-implementation";

export type CryptoType = "ES256";

/**
 * JOSE algorithm names used for SD-JWT VC
 */
export type JoseAlgorithm = "ES256" | "ES384" | "ES512";

/**
 * COSE algorithm identifiers used for mDOC (ISO 18013-5)
 * Uses RFC 9864 fully-specified algorithm identifiers
 * @see https://www.rfc-editor.org/rfc/rfc9864.html
 */
export type CoseAlgorithm = number;

@Injectable()
export class CryptoImplementationService {
    private readonly supportedAlgorithms: CryptoType[] = ["ES256"];
    private readonly cryptoMap: Map<CryptoType, CryptoImplementation>;
    private cachedDefaultAlg: CryptoType | null = null;

    constructor(private readonly configService: ConfigService) {
        // Initialize the map of algorithms to implementations
        this.cryptoMap = new Map([["ES256", ES256]]);
    }

    /**
     * Returns the list of supported algorithm types
     * @returns Array of supported algorithm types
     */
    getSupportedAlgorithms(): CryptoType[] {
        return [...this.supportedAlgorithms];
    }

    /**
     * Returns the supported algorithms based on the credential format.
     * - For SD-JWT VC: Returns JOSE algorithm names (ES256)
     * - For mDOC: Returns COSE algorithm identifiers (-7)
     * @param credentialFormat The credential format
     * @returns Array of algorithm identifiers appropriate for the format
     */
    getAlgs(
        credentialFormat: CredentialFormat,
    ): (JoseAlgorithm | CoseAlgorithm)[] {
        // Map internal crypto types to JOSE algorithms
        const joseAlgs: JoseAlgorithm[] = this.supportedAlgorithms.map(
            (alg) => {
                switch (alg) {
                    case "ES256":
                        return "ES256";
                    default:
                        throw new Error(`Unsupported algorithm: ${alg}`);
                }
            },
        );

        if (credentialFormat === CredentialFormat.SD_JWT_VC) {
            return joseAlgs;
        }

        if (credentialFormat === CredentialFormat.MSO_MDOC) {
            return joseAlgs
                .map((alg) =>
                    jwaSignatureAlgorithmToFullySpecifiedCoseAlgorithm(alg),
                )
                .filter((alg) => alg !== undefined);
        }

        // Default to JOSE algorithms
        return joseAlgs;
    }

    /**
     * Return the algorithm that is used for the crypto operations like signing.
     * @returns The configured algorithm type
     */
    getAlg(): CryptoType {
        if (!this.cachedDefaultAlg) {
            this.cachedDefaultAlg = this.configService.get(
                "CRYPTO_ALG",
            ) as CryptoType;

            // Validate the algorithm type
            if (!this.supportedAlgorithms.includes(this.cachedDefaultAlg)) {
                throw new Error(
                    `Unsupported algorithm: ${this.cachedDefaultAlg}`,
                );
            }
        }

        return this.cachedDefaultAlg;
    }

    /**
     * Returns the crypto implementation directly based on the JWK properties.
     * Currently supports ES256 (P-256 curve).
     * @param jwk - JSON Web Key
     * @returns The appropriate crypto implementation
     * @throws Error if the crypto implementation cannot be determined from the JWK
     */
    getCryptoFromJwk(jwk: JsonWebKey): CryptoImplementation {
        if (!jwk || typeof jwk !== "object") {
            throw new Error("Invalid JWK provided");
        }

        // Check for ES256 (P-256 curve)
        if (jwk.kty === "EC" && jwk.crv === "P-256") {
            return this.cryptoMap.get("ES256")!;
        }

        throw new Error(
            `Unable to determine crypto implementation from JWK: unsupported key type or curve`,
        );
    }

    /**
     * Returns the crypto implementation based on the provided or configured algorithm.
     * @param alg - Optional algorithm type, defaults to the configured algorithm
     * @returns The appropriate crypto implementation
     * @throws Error if the algorithm is not supported
     */
    getCrypto(alg?: string): CryptoImplementation {
        const algorithmType = alg || this.getAlg();
        const implementation = this.cryptoMap.get(algorithmType as CryptoType);

        if (!implementation) {
            throw new Error(`Unsupported algorithm: ${algorithmType}`);
        }

        return implementation;
    }
}
