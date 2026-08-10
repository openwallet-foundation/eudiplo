import { createZodDto } from "nestjs-zod";
import { ImportTenantSchema } from "../schemas/create-tenant.schema";

export class ImportTenantDto extends createZodDto(ImportTenantSchema) {}
