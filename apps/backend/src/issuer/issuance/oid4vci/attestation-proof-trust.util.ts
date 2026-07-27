import { decodeProtectedHeader } from "jose";
import { TrustStoreService } from "../../../shared/trust/trust-store.service";
import {
    normalizeTrustListRefs,
    ServiceTypeIdentifiers,
    TrustListInput,
    TrustListSource,
} from "../../../shared/trust/types";
import { X509ValidationService } from "../../../shared/trust/x509-validation.service";
import { CredentialRequestException } from "./exceptions";

export interface AttestationProofTrustValidationDeps {
    trustStoreService: TrustStoreService;
    x509ValidationService: X509ValidationService;
}

/**
 * Validate attestation proof signer chain against configured trusted wallet providers.
 * If no trust list is configured, this check is skipped for backward compatibility.
 */
export async function validateAttestationProofTrust(
    keyAttestationJwt: string,
    trustListRefsInput: TrustListInput[],
    deps: AttestationProofTrustValidationDeps,
): Promise<void> {
    const trustListRefs = normalizeTrustListRefs(trustListRefsInput);

    if (trustListRefs.length === 0) {
        return;
    }

    try {
        const header = decodeProtectedHeader(keyAttestationJwt);
        const x5c = header.x5c;
        if (!Array.isArray(x5c) || x5c.length === 0) {
            throw new CredentialRequestException(
                "invalid_proof",
                "Attestation proof must contain an x5c certificate chain for trust validation",
            );
        }

        const trustListSource: TrustListSource = {
            lotes: trustListRefs,
            acceptedServiceTypes: [ServiceTypeIdentifiers.WalletProvider],
        };

        const trustStore =
            await deps.trustStoreService.getTrustStore(trustListSource);
        if (trustStore.entities.length === 0) {
            throw new CredentialRequestException(
                "invalid_proof",
                "No trusted wallet providers found in configured trust lists",
            );
        }

        const presentedChain = deps.x509ValidationService.parseX5c(x5c);
        const leaf = presentedChain[0];
        if (!leaf) {
            throw new CredentialRequestException(
                "invalid_proof",
                "Attestation proof x5c chain is empty",
            );
        }

        const anchors = deps.x509ValidationService.parseTrustAnchors(
            trustStore.entities.flatMap((entity) => entity.services),
        );

        const path = await deps.x509ValidationService.buildPath(
            leaf,
            presentedChain,
            anchors,
        );

        const matched =
            await deps.x509ValidationService.pathMatchesTrustedEntities(
                path,
                trustStore.entities,
                "leaf",
                ServiceTypeIdentifiers.WalletProvider,
            );

        if (!matched) {
            throw new CredentialRequestException(
                "invalid_proof",
                "Attestation proof signer is not trusted by configured wallet provider trust lists",
            );
        }
    } catch (error) {
        if (error instanceof CredentialRequestException) {
            throw error;
        }
        throw new CredentialRequestException(
            "invalid_proof",
            "Attestation proof x5c chain could not be validated",
        );
    }
}
