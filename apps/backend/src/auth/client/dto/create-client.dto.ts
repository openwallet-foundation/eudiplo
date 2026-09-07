import { createZodDto } from "nestjs-zod";
import { CreateClientSchema } from "../schemas/client.schema.js";

export class CreateClientDto extends createZodDto(CreateClientSchema) {}
