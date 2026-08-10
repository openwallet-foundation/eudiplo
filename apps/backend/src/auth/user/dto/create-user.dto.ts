import { createZodDto } from "nestjs-zod";
import { CreateUserSchema } from "../schemas/create-user.schema";

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
