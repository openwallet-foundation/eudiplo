import { z } from "zod";
import { allRoles } from "../../roles/role.enum";
import { SessionStorageConfigSchema } from "./session-storage-config.schema";
import { StatusListConfigSchema } from "./status-list-config.schema";

const RoleSchema = z.enum(
    allRoles as [(typeof allRoles)[number], ...(typeof allRoles)[number][]],
);

const NonBlankStringSchema = z.string().trim().min(1);

export const CreateTenantSchema = z
    .strictObject({
        id: NonBlankStringSchema.describe("Unique tenant identifier."),
        name: NonBlankStringSchema.default("EUDIPLO").describe(
            "Display name of the tenant.",
        ),
        description: NonBlankStringSchema.optional().describe(
            "Optional tenant description.",
        ),
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
    sessionConfig: true,
    statusListConfig: true,
}).describe("Payload used when importing tenant metadata from config files.");

export const UpdateTenantSchema = z
    .strictObject({
        name: NonBlankStringSchema.optional().describe(
            "Display name of the tenant.",
        ),
        description: NonBlankStringSchema.nullable()
            .optional()
            .describe(
                "Tenant description. Omit to keep the current value or set to null to remove it.",
            ),
        sessionConfig: SessionStorageConfigSchema.optional().describe(
            "Optional tenant-specific session storage configuration.",
        ),
        statusListConfig: StatusListConfigSchema.optional().describe(
            "Optional tenant-specific status list defaults.",
        ),
    })
    .describe("Payload for partially updating tenant metadata.");

export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type ImportTenant = z.infer<typeof ImportTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
