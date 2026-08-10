import { createZodDto } from "nestjs-zod";
import { UpdateTenantSchema } from "../schemas/create-tenant.schema";

export class UpdateTenantDto extends createZodDto(UpdateTenantSchema) {}
