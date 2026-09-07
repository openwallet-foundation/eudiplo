import { createZodDto } from "nestjs-zod";
import { ImportTenantSchema } from "../schemas/create-tenant.schema.js";

export class ImportTenantDto extends createZodDto(ImportTenantSchema) {}
