import { createZodDto } from "nestjs-zod";
import { UpdateTenantSchema } from "../schemas/create-tenant.schema.js";

export class UpdateTenantDto extends createZodDto(UpdateTenantSchema) {}
