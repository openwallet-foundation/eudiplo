import { createZodDto } from "nestjs-zod";
import { ClientCredentialsSchema } from "./client-credentials.schema";

export class ClientCredentialsDto extends createZodDto(
    ClientCredentialsSchema,
) {}
