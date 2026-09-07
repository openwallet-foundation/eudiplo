import { createZodDto } from "nestjs-zod";
import { UpdateClientSchema } from "../schemas/client.schema.js";

export class UpdateClientDto extends createZodDto(UpdateClientSchema) {}
