import { z } from "zod";
import { Role } from "../../roles/role.enum";

const rolesSchema = z
    .array(z.enum(Role))
    .min(1)
    .describe("Roles assigned to the client. At least one role is required.");

export const CreateClientSchema = z
    .object({
        clientId: z.string().min(1).describe("Unique client identifier."),
        secret: z
            .string()
            .min(1)
            .optional()
            .describe("Optional client secret for confidential clients."),
        description: z
            .string()
            .min(1)
            .optional()
            .describe("Optional human-readable client description."),
        roles: rolesSchema,
        allowedPresentationConfigs: z
            .array(z.string().min(1))
            .nullable()
            .optional()
            .describe(
                "Optional allow-list of presentation config ids this client can use.",
            ),
        allowedIssuanceConfigs: z
            .array(z.string().min(1))
            .nullable()
            .optional()
            .describe(
                "Optional allow-list of issuance config ids this client can use.",
            ),
    })
    .describe("Payload for creating a client configuration.")
    .strict();

export const UpdateClientSchema = z
    .object({
        description: z
            .string()
            .min(1)
            .optional()
            .describe("Optional updated description."),
        roles: rolesSchema
            .optional()
            .describe("Optional replacement roles for the client."),
        allowedPresentationConfigs: z
            .array(z.string().min(1))
            .nullable()
            .optional()
            .describe(
                "Optional replacement allow-list of presentation config ids.",
            ),
        allowedIssuanceConfigs: z
            .array(z.string().min(1))
            .nullable()
            .optional()
            .describe(
                "Optional replacement allow-list of issuance config ids.",
            ),
    })
    .describe("Payload for partially updating a client configuration.")
    .strict();

export type CreateClient = z.infer<typeof CreateClientSchema>;
export type UpdateClient = z.infer<typeof UpdateClientSchema>;
