import { createZodDto } from "nestjs-zod";
import { UpdateClientSchema } from "../schemas/client.schema";

export class UpdateClientDto extends createZodDto(UpdateClientSchema) {}
