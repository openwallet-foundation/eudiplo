import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    ChainedAsTokenConfigSchema,
    UpstreamOidcConfigSchema,
    ChainedAsTokenConfig,
    UpstreamOidcConfig,
} from "./chained-as-config.dto";

export type AuthorizationServerType =
    | "external"
    | "oid4vp"
    | "chained"
    | "built-in";

const ExternalAccessTokenClaimSessionBindingSchema = z
    .object({
        method: z.literal("access_token_claim"),
        claim: z.string().min(1),
    })
    .strict();

const ManagedAuthorizationServerConfigSchema = z
    .object({
        type: z.enum(["external", "oid4vp", "chained", "built-in"]),
        id: z.string(),
        label: z.string().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

const ExternalAuthorizationServerConfigSchema = z
    .object({
        type: z.literal("external"),
        id: z.string(),
        issuer: z.string(),
        sessionBinding: ExternalAccessTokenClaimSessionBindingSchema.optional(),
        label: z.string().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

export class ExternalAccessTokenClaimSessionBinding extends createZodDto(
    ExternalAccessTokenClaimSessionBindingSchema,
) {
    @ApiProperty({
        description:
            "Session correlation method for external authorization servers.",
        enum: ["access_token_claim"],
        example: "access_token_claim",
    })
    method!: "access_token_claim";

    @ApiProperty({
        description:
            "Name of the external access-token claim that carries issuer_state.",
        example: "issuer_state",
    })
    claim!: string;
}

const Oid4VpAuthorizationServerConfigSchema = z
    .object({
        type: z.literal("oid4vp"),
        id: z.string(),
        presentationConfigId: z.string(),
        immediateWalletRedirect: z.boolean().optional(),
        token: ChainedAsTokenConfigSchema.optional(),
        requireDPoP: z.boolean().optional(),
        label: z.string().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

const ChainedAuthorizationServerConfigSchema = z
    .object({
        type: z.literal("chained"),
        id: z.string(),
        upstream: UpstreamOidcConfigSchema,
        token: ChainedAsTokenConfigSchema.optional(),
        requireDPoP: z.boolean().optional(),
        label: z.string().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

const BuiltInAuthorizationServerConfigSchema = z
    .object({
        type: z.literal("built-in"),
        id: z.string(),
        token: ChainedAsTokenConfigSchema.optional(),
        requireDPoP: z.boolean().optional(),
        label: z.string().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

export class ManagedAuthorizationServerConfig extends createZodDto(
    ManagedAuthorizationServerConfigSchema,
) {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["external", "oid4vp", "chained", "built-in"],
        example: "external",
    })
    type!: AuthorizationServerType;

    @ApiProperty({
        description: "Unique identifier for this authorization server",
        example: "pid-auth",
    })
    id!: string;

    @ApiPropertyOptional({
        description: "Human-friendly label for the UI",
        example: "PID Authorization Server",
    })
    label?: string;

    @ApiPropertyOptional({
        description: "Whether this managed authorization server is enabled",
        default: true,
    })
    enabled?: boolean;
}

export class ExternalAuthorizationServerConfig extends createZodDto(
    ExternalAuthorizationServerConfigSchema,
) {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["external"],
        example: "external",
    })
    declare type: "external";

    @ApiProperty({
        description: "Unique identifier for this authorization server",
        example: "external-auth",
    })
    declare id: string;

    @ApiProperty({
        description: "Issuer URL for external authorization servers",
        example: "https://auth.example.com",
    })
    declare issuer: string;

    @ApiPropertyOptional({
        description:
            "Explicit contract describing how issuer_state is propagated by the external AS.",
        type: () => ExternalAccessTokenClaimSessionBinding,
    })
    declare sessionBinding?: ExternalAccessTokenClaimSessionBinding;

    declare label?: string;

    declare enabled?: boolean;
}

export class Oid4VpAuthorizationServerConfig extends createZodDto(
    Oid4VpAuthorizationServerConfigSchema,
) {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["oid4vp"],
        example: "oid4vp",
    })
    declare type: "oid4vp";

    @ApiProperty({
        description: "Stable identifier used in the AS URL path",
        example: "pid-auth",
    })
    declare id: string;

    @ApiProperty({
        description: "Presentation configuration ID to use for OID4VP",
        example: "playground-pid",
    })
    declare presentationConfigId: string;

    @ApiPropertyOptional({
        description:
            "Immediately redirect the browser into the wallet OID4VP request",
        default: true,
    })
    declare immediateWalletRedirect?: boolean;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    declare requireDPoP?: boolean;

    declare label?: string;

    declare enabled?: boolean;
}

export class ChainedAuthorizationServerConfig extends createZodDto(
    ChainedAuthorizationServerConfigSchema,
) {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["chained"],
        example: "chained",
    })
    declare type: "chained";

    @ApiProperty({
        description: "Unique identifier for this authorization server",
        example: "chained-auth",
    })
    declare id: string;

    @ApiProperty({
        description: "Upstream OIDC provider configuration for chained mode",
        type: () => UpstreamOidcConfig,
    })
    declare upstream: UpstreamOidcConfig;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    declare requireDPoP?: boolean;

    declare label?: string;

    declare enabled?: boolean;
}

export class BuiltInAuthorizationServerConfig extends createZodDto(
    BuiltInAuthorizationServerConfigSchema,
) {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["built-in"],
        example: "built-in",
    })
    declare type: "built-in";

    @ApiProperty({
        description: "Unique identifier for this authorization server",
        example: "issuer-built-in",
    })
    declare id: string;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    declare requireDPoP?: boolean;

    declare label?: string;

    declare enabled?: boolean;
}
