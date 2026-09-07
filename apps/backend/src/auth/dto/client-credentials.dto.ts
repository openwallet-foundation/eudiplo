import { createZodDto } from "nestjs-zod";
import { ClientCredentialsSchema } from "./client-credentials.schema.js";

export class ClientCredentialsDto extends createZodDto(
    ClientCredentialsSchema,
) {}
