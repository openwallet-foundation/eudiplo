import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export enum FederationTrustMode {
    FEDERATION_ONLY = "federation-only",
    HYBRID = "hybrid",
}

export enum FederationEntityRole {
    TRUST_ANCHOR = "trust_anchor",
    INTERMEDIATE = "intermediate",
    LEAF = "leaf",
}

const FederationTrustAnchorConfigSchema = z
    .object({
        entityId: z.string(),
        entityConfigurationUri: z.string(),
    })
    .strict();

const FederationConfigSchema = z
    .object({
        role: z.enum(FederationEntityRole).optional(),
        mode: z.enum(FederationTrustMode).optional(),
        entityId: z.string().optional(),
        enforceSigningPolicy: z.boolean().optional(),
        cacheTtlSeconds: z.number().optional(),
        trustAnchors: z.array(FederationTrustAnchorConfigSchema),
    })
    .strict();

export class FederationTrustAnchorConfig extends createZodDto(
    FederationTrustAnchorConfigSchema,
) {
    @ApiProperty({
        description: "Entity identifier (sub) of the federation trust anchor.",
        example: "https://ta.example.org",
    })
    entityId!: string;

    @ApiProperty({
        description:
            "Federation endpoint URL for the trust anchor entity configuration.",
        example: "https://ta.example.org/.well-known/openid-federation",
    })
    entityConfigurationUri!: string;
}

export class FederationConfig extends createZodDto(FederationConfigSchema) {
    @ApiPropertyOptional({
        enum: FederationEntityRole,
        description:
            "Role this tenant plays in the OpenID Federation topology.",
        default: FederationEntityRole.LEAF,
    })
    role?: FederationEntityRole;

    @ApiPropertyOptional({
        enum: FederationTrustMode,
        description:
            "Trust decision strategy when both LoTE trust lists and OpenID Federation are configured.",
        default: FederationTrustMode.HYBRID,
    })
    mode?: FederationTrustMode;

    @ApiPropertyOptional({
        description:
            "Entity identifier of this issuer/verifier in the federation.",
        example: "https://issuer.example.org",
    })
    entityId?: string;

    @ApiPropertyOptional({
        description:
            "Whether federation checks are enforced for upstream metadata and signer trust decisions.",
        default: true,
    })
    enforceSigningPolicy?: boolean;

    @ApiPropertyOptional({
        description:
            "Cache TTL in seconds for federation entity statements and trust chain results.",
        default: 300,
    })
    cacheTtlSeconds?: number;

    @ApiProperty({
        type: () => [FederationTrustAnchorConfig],
        description: "Configured federation trust anchors.",
    })
    trustAnchors!: FederationTrustAnchorConfig[];
}
