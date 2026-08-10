/**
 * Key usage types for different purposes in the system.
 */
export enum KeyUsageType {
    /** Used for OAuth/OIDC access token signing and authentication */
    Access = "access",
    /** Used for credential/attestation signing (SD-JWT VC, mDOC, etc.) */
    Attestation = "attestation",
    /** Used for trust list signing */
    TrustList = "trustList",
    /** Used for status list (credential revocation) signing */
    StatusList = "statusList",
    /** Used for encryption (JWE) */
    Encrypt = "encrypt",
}
