/**
 * Migration index - exports all migration classes for TypeORM.
 * Import migrations directly to avoid ESM/CJS compatibility issues
 * with dynamic file loading during tests.
 */
export { BaselineMigration1740000000000 } from "./1740000000000-BaselineMigration";
export { AddKmsProvider1740500000000 } from "./1740500000000-AddKmsProvider";
export { AddSigningKeyIdToIssuanceConfig1741000000000 } from "./1741000000000-AddSigningKeyIdToIssuanceConfig";
export { AddPreferredAuthServerToIssuanceConfig1741500000000 } from "./1741500000000-AddPreferredAuthServerToIssuanceConfig";
export { AddExternalKeyId1742000000000 } from "./1742000000000-AddExternalKeyId";
export { AddKeyUsageEntity1743000000000 } from "./1743000000000-AddKeyUsageEntity";
export { AddKeyRotation1744000000000 } from "./1744000000000-AddKeyRotation";
export { RenameSigningToAttestation1745000000000 } from "./1745000000000-RenameSigningToAttestation";
export { FlattenKeyUsageType1746000000000 } from "./1746000000000-FlattenKeyUsageType";
export { MigrateKeysToKeyChain1747000000000 } from "./1747000000000-MigrateKeysToKeyChain";
export { ExtractAttributeProviderAndWebhookEndpoint1748000000000 } from "./1748000000000-ExtractAttributeProviderAndWebhookEndpoint";
export { AddSessionLogEntry1749000000000 } from "./1749000000000-AddSessionLogEntry";
export { AddSessionErrorReason1750000000000 } from "./1750000000000-AddSessionErrorReason";
export { AddDirectPostSecurityFields1751000000000 } from "./1751000000000-AddDirectPostSecurityFields";
export { AddRefreshTokenToSession1752000000000 } from "./1752000000000-AddRefreshTokenToSession";
export { AddCredentialResponseEncryptionToIssuanceConfig1753000000000 } from "./1753000000000-AddCredentialResponseEncryptionToIssuanceConfig";
export { AddCredentialRequestEncryptionToIssuanceConfig1753100000000 } from "./1753100000000-AddCredentialRequestEncryptionToIssuanceConfig";
export { AddRefreshTokenToChainedAsSession1754000000000 } from "./1754000000000-AddRefreshTokenToChainedAsSession";
export { AddRegistrationCertificateDefaultsToRegistrarConfig1755000000000 } from "./1755000000000-AddRegistrationCertificateDefaultsToRegistrarConfig";
export { AddRegistrationCertCacheToPresentationConfig1756000000000 } from "./1756000000000-AddRegistrationCertCacheToPresentationConfig";
export { AddTxCodeAttemptTracking1757000000000 } from "./1757000000000-AddTxCodeAttemptTracking";
export { AddSessionSingleUseTracking1760000000000 } from "./1760000000000-AddSessionSingleUseTracking";
export { AddSchemaMetaToCredentialConfig1761000000000 } from "./1761000000000-AddSchemaMetaToCredentialConfig";
export { AddTenantActionLog1762000000000 } from "./1762000000000-AddTenantActionLog";
export { AddFederationToIssuanceConfig1763000000000 } from "./1763000000000-AddFederationToIssuanceConfig";
