import { createZodDto } from "nestjs-zod";
import { KmsConfigSchema } from "../schemas/kms-config.schema.js";

export type { KmsProviderType } from "../schemas/kms-config.schema.js";

export class KmsConfigDto extends createZodDto(KmsConfigSchema) {}
