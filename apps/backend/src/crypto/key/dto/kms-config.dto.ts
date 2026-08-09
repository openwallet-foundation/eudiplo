import { createZodDto, type ZodDto } from "nestjs-zod";
import { KmsConfigSchema } from "../schemas/kms-config.schema";

export { KmsConfigSchema } from "../schemas/kms-config.schema";
export type {
    KmsConfig,
    KmsProviderType,
} from "../schemas/kms-config.schema";

// Backward-compatible alias while callers migrate from class DTO names.
export type KmsProviderConfigDto =
    import("../schemas/kms-config.schema").KmsProviderConfig;

export const KmsConfigDto: ZodDto<typeof KmsConfigSchema, false> =
    createZodDto(KmsConfigSchema);
