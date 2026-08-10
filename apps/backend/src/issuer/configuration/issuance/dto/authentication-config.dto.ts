import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    WebhookConfig,
    WebhookConfigSchema,
} from "../../../../shared/utils/webhook/webhook.dto";

const AuthenticationUrlConfigSchema = z
    .object({
        url: z.string(),
        webhook: WebhookConfigSchema.optional(),
    })
    .strict();

const PresentationDuringIssuanceConfigSchema = z
    .object({
        type: z.string(),
    })
    .strict();

const AuthenticationMethodPresentationSchema = z
    .object({
        method: z.literal("presentationDuringIssuance"),
        config: PresentationDuringIssuanceConfigSchema,
    })
    .strict();

const AuthenticationMethodAuthSchema = z
    .object({
        method: z.literal("auth"),
        config: AuthenticationUrlConfigSchema,
    })
    .strict();

const AuthenticationMethodNoneSchema = z
    .object({
        method: z.literal("none"),
    })
    .strict();

/**
 * Configuration for authentication method 'auth'
 * Used for OID4VCI authorized code flow where the user will be redirected for authentication
 */
export class AuthenticationUrlConfig extends createZodDto(
    AuthenticationUrlConfigSchema,
) {
    /**
     * The URL used in the OID4VCI authorized code flow.
     * This URL is where users will be redirected for authentication.
     */
    url!: string;

    /**
     * Optional webhook configuration for authentication callbacks
     */
    webhook?: WebhookConfig;
}

/**
 * Configuration for authentication method 'presentationDuringIssuance'
 * Used for OID4VP flow where a credential presentation request is sent
 */
export class PresentationDuringIssuanceConfig extends createZodDto(
    PresentationDuringIssuanceConfigSchema,
) {
    /**
     * Link to the presentation configuration that is relevant for the issuance process
     */
    type!: string;
}

export class AuthenticationMethodPresentation
    extends createZodDto(AuthenticationMethodPresentationSchema)
    implements AuthenticationMethodInterface
{
    method!: "presentationDuringIssuance";
    config!: PresentationDuringIssuanceConfig;
}

export class AuthenticationMethodAuth
    extends createZodDto(AuthenticationMethodAuthSchema)
    implements AuthenticationMethodInterface
{
    method!: "auth";
    config!: AuthenticationUrlConfig;
}

export class AuthenticationMethodNone
    extends createZodDto(AuthenticationMethodNoneSchema)
    implements AuthenticationMethodInterface
{
    method!: "none";
}

interface AuthenticationMethodInterface {
    method: "none" | "auth" | "presentationDuringIssuance";
}
