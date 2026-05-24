import { Injectable, Logger } from "@nestjs/common";
import type { Jwk } from "@openid4vc/oauth2";
import { CoseKey, DeviceKey, Issuer, SignatureAlgorithm } from "@owf/mdoc";
import { X509Certificate } from "@peculiar/x509";
import { exportJWK, importX509 } from "jose";
import { CertService } from "../../../../../crypto/key/cert/cert.service";
import { KeyUsageType } from "../../../../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../../../../crypto/key/key-chain.service";
import { Session } from "../../../../../session/entities/session.entity";
import { mdocContext } from "../../../../../verifier/presentations/mdoc-context";
import { CredentialConfig } from "../../entities/credential.entity";
import { buildClaimsByNamespace } from "../../utils";

export interface MdocIssueOptions {
    credentialConfiguration: CredentialConfig;
    deviceKey: Jwk;
    session: Session;
    claims: Record<string, any>;
}

/**
 * Service for issuing mDOC credentials following ISO 18013-5.
 */
@Injectable()
export class MdocIssuerService {
    private readonly logger = new Logger(MdocIssuerService.name);

    constructor(
        private readonly certService: CertService,
        private readonly keyChainService: KeyChainService,
    ) {}

    /**
     * Issues an mDOC credential.
     * @param options - The issuance options
     * @returns The issued mDOC credential as base64url encoded string for OID4VCI
     */
    async issue(options: MdocIssueOptions): Promise<string> {
        const { credentialConfiguration, deviceKey, session, claims } = options;

        // Get the docType from the credential configuration
        // Support both docType (camelCase) and doctype (lowercase per OID4VCI spec)
        // Default to mDL if not specified
        const docType =
            credentialConfiguration.config.docType ||
            (credentialConfiguration.config as any).doctype ||
            "org.iso.18013.5.1.mDL";

        const issuer = new Issuer(docType, mdocContext);

        const defaultNamespace = this.getDefaultNamespace(docType);
        const claimsByNamespace = buildClaimsByNamespace(
            credentialConfiguration.fields as any,
        );

        if (claimsByNamespace && Object.keys(claimsByNamespace).length > 0) {
            // Multiple namespaces specified
            for (const [ns, nsClaims] of Object.entries(claimsByNamespace)) {
                issuer.addIssuerNamespace(ns, nsClaims);
            }
            if (claims && Object.keys(claims).length > 0) {
                issuer.addIssuerNamespace(defaultNamespace, claims);
            }
        } else {
            // Single namespace with flat claims
            issuer.addIssuerNamespace(defaultNamespace, claims);
        }

        // Get signing certificate
        const certificate = await this.certService.find({
            tenantId: session.tenantId,
            type: KeyUsageType.Attestation,
            keyId: credentialConfiguration.keyChainId,
        });

        // Get the private key for signing via KeyChainEntity
        const keyChain = await this.keyChainService.getEntity(
            session.tenantId,
            certificate.keyId,
        );
        const privateKey = await exportJWK(
            await crypto.subtle.importKey(
                "jwk",
                keyChain.activeJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign"],
            ),
        );

        // Convert all certificates in the chain to Uint8Array
        // certificate.crt is an array: [leaf, intermediate..., root]
        const certificateChain = certificate.crt.map((certPem) => {
            const x509Cert = new X509Certificate(certPem);
            return new Uint8Array(x509Cert.rawData);
        });

        // Diagnostic: log the leaf cert that will be embedded in the mDOC.
        try {
            const leaf = new X509Certificate(certificate.crt[0]);
            const thumb = Buffer.from(
                await crypto.subtle.digest("SHA-256", leaf.rawData),
            )
                .toString("hex")
                .toUpperCase()
                .replace(/(.{2})/g, "$1:")
                .slice(0, -1);
            this.logger.log(
                `mDOC issuance: tenant=${session.tenantId} keyChainId=${certificate.keyId} leaf.subject="${leaf.subject}" thumbprint=${thumb}`,
            );
        } catch {
            // ignore diagnostic failures
        }

        // Ensure the private key used for signing matches the embedded leaf certificate.
        await this.assertSigningKeyMatchesLeafCertificate(
            privateKey as Jwk,
            certificate.crt[0],
        );

        // Set validity dates
        const signed = new Date();
        const validFrom = new Date(signed);
        const validUntil = new Date(signed);

        // Use lifeTime from config or default to 1 year
        if (credentialConfiguration.lifeTime) {
            validUntil.setSeconds(
                validUntil.getSeconds() + credentialConfiguration.lifeTime,
            );
        } else {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        }

        // Sign the mDOC
        const issuerSigned = await issuer.sign({
            signingKey: CoseKey.fromJwk(privateKey as Jwk),
            certificates: certificateChain,
            algorithm: SignatureAlgorithm.ES256,
            digestAlgorithm: "SHA-256",
            deviceKeyInfo: { deviceKey: DeviceKey.fromJwk(deviceKey) },
            validityInfo: { signed, validFrom, validUntil },
        });

        this.logger.debug(
            `Issued mDOC credential for docType: ${docType}, tenant: ${session.tenantId}`,
        );

        // Return the encoded credential for OID4VCI
        return issuerSigned.encodedForOid4Vci;
    }

    private async assertSigningKeyMatchesLeafCertificate(
        privateJwk: Jwk,
        leafCertificatePem?: string,
    ): Promise<void> {
        if (!leafCertificatePem) {
            throw new Error(
                "mDOC issuance failed: no leaf certificate configured on the selected attestation key chain",
            );
        }

        const certPublicKey = await importX509(leafCertificatePem, "ES256", {
            extractable: true,
        });
        const certPublicJwk = (await exportJWK(certPublicKey)) as Jwk;

        const privateJwkPublicPart = {
            kty: privateJwk.kty,
            crv: privateJwk.crv,
            x: privateJwk.x,
            y: privateJwk.y,
        };
        const certJwkPublicPart = {
            kty: certPublicJwk.kty,
            crv: certPublicJwk.crv,
            x: certPublicJwk.x,
            y: certPublicJwk.y,
        };

        if (
            privateJwkPublicPart.kty !== certJwkPublicPart.kty ||
            privateJwkPublicPart.crv !== certJwkPublicPart.crv ||
            privateJwkPublicPart.x !== certJwkPublicPart.x ||
            privateJwkPublicPart.y !== certJwkPublicPart.y
        ) {
            this.logger.error(
                "mDOC issuance key mismatch: active signing key does not match leaf certificate public key",
            );
            throw new Error(
                "mDOC issuance failed: signing key does not match the embedded attestation certificate. Regenerate or re-import the certificate for this key chain.",
            );
        }
    }

    /**
     * Get the default namespace for a given docType.
     */
    private getDefaultNamespace(docType: string): string {
        // For mDL, the namespace is typically "org.iso.18013.5.1"
        if (docType === "org.iso.18013.5.1.mDL") {
            return "org.iso.18013.5.1";
        }
        // For other docTypes, use the docType as namespace
        return docType;
    }
}
