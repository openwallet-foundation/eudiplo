export enum PresentationFailureCode {
    WalletError = "wallet_error",
    CredentialStatusInvalid = "credential_status_invalid",
    CredentialExpired = "credential_expired",
    CredentialNotYetValid = "credential_not_yet_valid",
    IssuerNotTrusted = "issuer_not_trusted",
    HolderBindingFailed = "holder_binding_failed",
    PresentationRequirementsNotSatisfied = "presentation_requirements_not_satisfied",
    ResponseInvalid = "response_invalid",
    SessionExpired = "session_expired",
    ReplayDetected = "replay_detected",
    VerificationFailed = "verification_failed",
    InternalError = "internal_error",
}

export const WALLET_PROTOCOL_ERROR_ALLOWLIST = new Set<string>([
    "invalid_request",
    "unauthorized_client",
    "access_denied",
    "unsupported_response_type",
    "invalid_scope",
    "server_error",
    "temporarily_unavailable",
]);
