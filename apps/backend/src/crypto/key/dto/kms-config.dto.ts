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

export const KmsConfigDto: ZodDto<typeof KmsConfigSchema, false> =
    createZodDto(KmsConfigSchema);
