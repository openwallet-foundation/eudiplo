import { z } from "zod";

export const ClientCredentialsSchema = z.strictObject({
    grant_type: z.string().trim().min(1).optional(),
    client_id: z.string().trim().min(1).optional(),
    client_secret: z.string().trim().min(1).optional(),
});
