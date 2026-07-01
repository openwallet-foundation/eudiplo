import { timingSafeEqual } from "node:crypto";
import { p256 } from "@noble/curves/nist.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { coseKeyToJwkClaim } from "@owf/cose";
import {
    CoseKey,
    type MdocContext,
} from "@owf/mdoc";
import { hkdf } from "@panva/hkdf";
import * as x509 from "@peculiar/x509";
import { X509Certificate } from "@peculiar/x509";
import { exportJWK, importX509 } from "jose";
import { toBuffer } from "../../shared/utils/buffer.util";
import { hex } from "@owf/identity-common";

// Use global Web Crypto API (available in Node.js 19+)
const webCrypto = globalThis.crypto;

export const mdocContext: MdocContext = {
    fetch,
    crypto: {
        digest: async ({ digestAlgorithm, bytes }) => {
            const digest = await webCrypto.subtle.digest(
                digestAlgorithm,
                toBuffer(bytes),
            );
            return new Uint8Array(digest);
        },
        random: (length: number) => {
            return webCrypto.getRandomValues(new Uint8Array(length));
        },
        hdkf: async (input) => {
            const { digestAlgorithm: da, salt, info, publicKey, privateKey } =
                input;
            const ikm = p256
                .getSharedSecret(privateKey, publicKey, true)
                .slice(1);
            let digestAlgorithm: "sha256" | "sha384" | "sha512" = "sha256";
            if (da === "SHA-384") {
                digestAlgorithm = "sha384";
            } else if (da === "SHA-512") {
                digestAlgorithm = "sha512";
            }
            return hkdf(digestAlgorithm, ikm, salt, info, 32);
        },
    },

    cose: {
        mac0: {
            authenticate: async (input) => {
                const { key, toBeAuthenticated } = input;
                const keyBytes = key instanceof CoseKey ? key.privateKey : key;
                return hmac(sha256, keyBytes, toBeAuthenticated);
            },
            verify: async (input) => {
                const { tag, toBeAuthenticated, key } = input;
                const keyBytes = key instanceof CoseKey ? key.privateKey : key;
                const expectedTag = hmac(sha256, keyBytes, toBeAuthenticated);
                if (tag.length !== expectedTag.length) {
                    return false;
                }
                return timingSafeEqual(tag, expectedTag);
            },
        },
        sign1: {
            sign: async (input) => {
                const { key, toBeSigned } = input;
                return p256.sign(toBeSigned, key.privateKey, {
                    format: "compact",
                });
            },
            verify: async (input) => {
                const { signature, key, toBeVerified } = input;
                // lowS is needed after upgrade of @noble/curves to keep existing tests passing
                return p256.verify(signature, toBeVerified, key.publicKey, {
                    lowS: false,
                });
            },
        },
    },

    x509: {
        getIssuerNameField: (input: {
            certificate: Uint8Array;
            field: string;
        }) => {
            const certificate = new X509Certificate(
                toBuffer(input.certificate),
            );
            return certificate.issuerName.getField(input.field);
        },
        getPublicKey: async (input: {
            certificate: Uint8Array;
            algorithm?: Parameters<typeof coseKeyToJwkClaim.algorithm>[0];
        }) => {
            const certificate = new X509Certificate(
                toBuffer(input.certificate),
            );
            const alg = input.algorithm
                ? coseKeyToJwkClaim.algorithm(input.algorithm)
                : "ES256";

            const key = await importX509(certificate.toString(), alg, {
                extractable: true,
            });

            return CoseKey.fromJwk(
                (await exportJWK(key)) as unknown as Record<string, unknown>,
            );
        },

        verifyCertificateChain: async (input: {
            trustedCertificates: Array<Uint8Array>;
            x5chain: Array<Uint8Array>;
            now?: Date;
        }) => {
            const { trustedCertificates, x5chain: certificateChain, now } =
                input;

            if (certificateChain.length === 0) {
                throw new Error("Certificate chain is empty");
            }

            const parsedLeafCertificate = new x509.X509Certificate(
                toBuffer(certificateChain[0]),
            );
            const certificatesToBuildChain = [
                ...certificateChain,
                ...(trustedCertificates ?? []),
            ].map((certificate) => new x509.X509Certificate(toBuffer(certificate)));

            const certificateChainBuilder = new x509.X509ChainBuilder({
                certificates: certificatesToBuildChain,
            });
            const chain = await certificateChainBuilder.build(parsedLeafCertificate);

            // x5c is leaf-first, but chain builder returns root-first.
            let parsedChain = chain.reverse();

            if (parsedChain.length < certificateChain.length) {
                throw new Error(
                    "Could not parse the full chain. Likely due to incorrect ordering",
                );
            }

            let previousCertificate: X509Certificate | undefined;
            if (trustedCertificates) {
                const parsedTrustedCertificates = trustedCertificates.map(
                    (trustedCertificate) =>
                        new X509Certificate(toBuffer(trustedCertificate)),
                );

                const trustedCertificateIndex = parsedChain.findIndex((cert) =>
                    parsedTrustedCertificates.some((trustedCert) =>
                        cert.equal(trustedCert),
                    ),
                );

                if (trustedCertificateIndex === -1) {
                    throw new Error(
                        "No trusted certificate was found while validating the X.509 chain",
                    );
                }

                if (trustedCertificateIndex > 0) {
                    previousCertificate = parsedChain[trustedCertificateIndex - 1];
                    parsedChain = parsedChain.slice(trustedCertificateIndex);
                }
            }

            for (let i = 0; i < parsedChain.length; i++) {
                const cert = parsedChain[i];
                const publicKey = previousCertificate
                    ? previousCertificate.publicKey
                    : undefined;

                const skipSignatureVerification =
                    i === 0 && Boolean(trustedCertificates) && !publicKey;
                if (!skipSignatureVerification) {
                    await cert.verify({
                        publicKey,
                        date: now ?? new Date(),
                    });
                }

                previousCertificate = cert;
            }

            return {
                chain: parsedChain.map((cert) => new Uint8Array(cert.rawData)),
            };
        },
        getCertificateData: async (input: { certificate: Uint8Array }) => {
            const certificate = new X509Certificate(
                toBuffer(input.certificate),
            );
            const thumbprint = await certificate.getThumbprint();
            const thumbprintHex = hex.encode(new Uint8Array(thumbprint));
            return {
                issuerName: certificate.issuerName.toString(),
                subjectName: certificate.subjectName.toString(),
                pem: certificate.toString(),
                serialNumber: certificate.serialNumber,
                thumbprint: thumbprintHex,
                notBefore: certificate.notBefore,
                notAfter: certificate.notAfter,
            };
        },
    },
};
