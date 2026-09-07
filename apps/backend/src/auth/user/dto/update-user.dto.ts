import { createZodDto } from "nestjs-zod";
import { UpdateUserSchema } from "../schemas/create-user.schema.js";

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
