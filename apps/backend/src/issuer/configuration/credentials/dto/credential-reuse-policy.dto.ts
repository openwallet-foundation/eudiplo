import { createZodDto } from "nestjs-zod";
import { CredentialReusePolicySchema } from "../schemas/credential-config.schema";

export class CredentialReusePolicy extends createZodDto(
    CredentialReusePolicySchema,
) {}
