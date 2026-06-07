import { JWK } from "jose";

export type RulebookTrustListRef = {
    url: string; // e.g. https://.../pid-provider.jwt
    // material to verify the trustlist JWT (out of scope here)
    // could be JWK, PEM, kid, etc.
    verifierKey?: JWK;
};

export type ServiceTypeIdentifier = string;

/** Well-known service type identifiers from ETSI TS 119 602 */
export const ServiceTypeIdentifiers = {
    EaaIssuance: "http://uri.etsi.org/19602/SvcType/EAA/Issuance",
    EaaRevocation: "http://uri.etsi.org/19602/SvcType/EAA/Revocation",
    /** Wallet provider service type for wallet attestation validation */
    WalletProvider: "http://uri.etsi.org/19602/SvcType/WalletProvider",
} as const;

/**
 * A service certificate from a TrustedEntity in a LoTE.
 */
export type TrustedEntityServiceCert = {
    serviceTypeIdentifier: ServiceTypeIdentifier;
    certValue: string; // PEM or base64 DER
};

/**
 * A TrustedEntity from a LoTE, containing its services grouped together.
 * This preserves the relationship between issuance and revocation certificates
 * from the same entity.
 */
export type TrustedEntity = {
    /** Entity identifier, if available */
    entityId?: string;
    /** All services for this entity */
    services: TrustedEntityServiceCert[];
};

/**
 * Helper to find a specific service type within a TrustedEntity.
 */
function findServiceByType(
    entity: TrustedEntity,
    serviceType: ServiceTypeIdentifier,
): TrustedEntityServiceCert | undefined {
    return entity.services.find((s) => s.serviceTypeIdentifier === serviceType);
}

/**
 * Get the issuance certificate from a TrustedEntity.
 */
function _getIssuanceCert(
    entity: TrustedEntity,
): TrustedEntityServiceCert | undefined {
    return findServiceByType(entity, ServiceTypeIdentifiers.EaaIssuance);
}

/**
 * Get the revocation certificate from a TrustedEntity.
 */
export function getRevocationCert(
    entity: TrustedEntity,
): TrustedEntityServiceCert | undefined {
    return findServiceByType(entity, ServiceTypeIdentifiers.EaaRevocation);
}

export type FederationTrustMode = "federation-only" | "lote-only" | "hybrid";

type FederationTrustAnchorRef = {
    entityId: string;
    entityConfigurationUri: string;
};

export type FederationTrustSource = {
    mode?: FederationTrustMode;
    entityId?: string;
    trustAnchors: FederationTrustAnchorRef[];
    cacheTtlSeconds?: number;
    enforceSigningPolicy?: boolean;
};

export type VerifierOptions = {
    trustListSource?: TrustListSource;
    federationTrustSource?: FederationTrustSource;
    policy: VerifyPolicy;
    /**
     * Transaction data from the OID4VP request.
     * When provided, the verifier will validate that the KB-JWT contains
     * transaction_data_hashes that match SHA-256 hashes of each transaction data string.
     * See OID4VP spec Appendix B.3.3.1 for details.
     */
    transactionData?: string[];
    /**
     * Expected KB-JWT audience for SD-JWT VC key binding validation.
     * Usually the verifier client_id from the presentation request.
     */
    keyBindingAudience?: string;
    /**
     * SD-JWT required disclosed claim keys.
     */
    requiredClaimKeys?: string[];
    /**
     * SD-JWT key binding nonce.
     */
    keyBindingNonce?: string;
};

export type TrustListSource = {
    lotes: RulebookTrustListRef[];
    // which service types from LoTE you want to accept as issuer identities
    acceptedServiceTypes?: ServiceTypeIdentifier[];
};

type VerifyPolicy = {
    requireX5c: boolean;
    revocation?: {
        enabled: boolean;
        failClosed?: boolean;
        fetchTimeoutMs?: number;
        cacheTtlMs?: number;
    };
    // If LoTE cert is CA=FALSE, treat it as pin:
    // - "leaf": require leaf cert to equal pinned cert
    // - "pathEnd": require chain to terminate at pinned cert (rare)
    pinnedCertMode?: "leaf" | "pathEnd";
};
