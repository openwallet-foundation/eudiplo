import { z } from "zod";
import { allRoles } from "../../roles/role.enum";

const RoleSchema = z.enum(
    allRoles as [(typeof allRoles)[number], ...(typeof allRoles)[number][]],
);

export const CreateUserSchema = z.strictObject({
    username: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    roles: z.array(RoleSchema),
    enabled: z.boolean().optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
    password: z.string().min(8).optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
