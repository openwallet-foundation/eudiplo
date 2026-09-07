import { createZodDto } from "nestjs-zod";
import { CreateTenantSchema } from "../schemas/create-tenant.schema.js";

export class CreateTenantDto extends createZodDto(CreateTenantSchema) {}
