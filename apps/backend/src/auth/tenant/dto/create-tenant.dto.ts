import { createZodDto } from "nestjs-zod";
import { CreateTenantSchema } from "../schemas/create-tenant.schema";

export class CreateTenantDto extends createZodDto(CreateTenantSchema) {}
