import { createZodDto } from "nestjs-zod";
import { KmsConfigSchema } from "../schemas/kms-config.schema";

export type { KmsProviderType } from "../schemas/kms-config.schema";

export class KmsConfigDto extends createZodDto(KmsConfigSchema) {}
