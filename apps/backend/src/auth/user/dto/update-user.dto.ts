import { createZodDto } from "nestjs-zod";
import { UpdateUserSchema } from "../schemas/create-user.schema";

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
