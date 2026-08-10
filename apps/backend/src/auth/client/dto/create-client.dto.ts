import { createZodDto } from "nestjs-zod";
import { CreateClientSchema } from "../schemas/client.schema";

export class CreateClientDto extends createZodDto(CreateClientSchema) {}
