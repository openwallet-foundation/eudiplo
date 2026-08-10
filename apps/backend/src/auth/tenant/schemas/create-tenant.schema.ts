import { z } from "zod";
import { allRoles } from "../../roles/role.enum";
import { SessionStorageConfigSchema } from "./session-storage-config.schema";
import { StatusListConfigSchema } from "./status-list-config.schema";

const RoleSchema = z.enum(
    allRoles as [(typeof allRoles)[number], ...(typeof allRoles)[number][]],
);

export const CreateTenantSchema = z
    .strictObject({
        id: z.string().trim().min(1).describe("Unique tenant identifier."),
        name: z
            .string()
            .trim()
            .min(1)
            .default("EUDIPLO")
            .describe("Display name of the tenant."),
        description: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Optional tenant description."),
        roles: z
            .array(RoleSchema)
            .optional()
            .describe("Optional default role assignments for the tenant."),
        sessionConfig: SessionStorageConfigSchema.optional().describe(
            "Optional tenant-specific session storage configuration.",
        ),
        statusListConfig: StatusListConfigSchema.optional().describe(
            "Optional tenant-specific status list defaults.",
        ),
    })
    .describe("Payload for creating a tenant.");

export const ImportTenantSchema = CreateTenantSchema.pick({
    name: true,
    description: true,
}).describe("Payload used when importing tenant metadata from config files.");

export const UpdateTenantSchema = CreateTenantSchema.omit({
    id: true,
})
    .partial()
    .describe("Payload for partially updating tenant metadata.");

export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type ImportTenant = z.infer<typeof ImportTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
