import { createZodDto, type ZodDto } from "nestjs-zod";
import { KmsConfigSchema } from "../schemas/kms-config.schema";

export {
    AwsKmsConfigSchema,
    BaseKmsProviderConfigSchema,
    CscAuthorizeAuthDataSchema,
    CscKmsConfigSchema,
    DbKmsConfigSchema,
    HttpAuthBearerConfigSchema,
    HttpAuthMtlsConfigSchema,
    HttpAuthNoneConfigSchema,
    HttpAuthOauth2ConfigSchema,
    HttpKmsAuthConfigSchema,
    HttpKmsConfigSchema,
    KmsConfigSchema,
    Pkcs11KmsConfigSchema,
    VaultKmsConfigSchema,
} from "../schemas/kms-config.schema";
export type {
    HttpKmsAuthConfig,
    KmsConfig,
    KmsProviderConfig,
    KmsProviderType,
} from "../schemas/kms-config.schema";

// Backward-compatible alias while callers migrate from class DTO names.
export type KmsProviderConfigDto = import("../schemas/kms-config.schema").KmsProviderConfig;

export const KmsConfigDto: ZodDto<typeof KmsConfigSchema, false> =
    createZodDto(KmsConfigSchema);
