import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    IsUrl,
    ValidateIf,
    ValidateNested,
} from "class-validator";
import {
    ChainedAsTokenConfig,
    UpstreamOidcConfig,
} from "./chained-as-config.dto";

export class ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Stable identifier used in the AS URL path",
        example: "pid-auth",
    })
    @ValidateIf((o) => o.type === "oid4vp")
    @IsString()
    id?: string;

    @ApiPropertyOptional({
        description: "Human-friendly label for the UI",
        example: "PID Authorization Server",
    })
    @IsOptional()
    @IsString()
    label?: string;

    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["external", "oid4vp", "chained", "built-in"],
        example: "external",
    })
    @IsString()
    @IsIn(["external", "oid4vp", "chained", "built-in"])
    type!: "external" | "oid4vp" | "chained" | "built-in";

    @ApiPropertyOptional({
        description: "Issuer URL for external authorization servers",
        example: "https://auth.example.com",
    })
    @ValidateIf((o) => o.type === "external")
    @IsUrl({ require_tld: false })
    issuer?: string;

    @ApiPropertyOptional({
        description: "Upstream OIDC provider configuration for chained mode",
        type: () => UpstreamOidcConfig,
    })
    @ValidateIf((o) => o.type === "chained")
    @ValidateNested()
    @Type(() => UpstreamOidcConfig)
    upstream?: UpstreamOidcConfig;

    @ApiPropertyOptional({
        description: "Whether this managed authorization server is enabled",
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiProperty({
        description: "Presentation configuration ID to use for OID4VP",
        example: "playground-pid",
    })
    @ValidateIf((o) => o.type === "oid4vp")
    @IsString()
    presentationConfigId?: string;

    @ApiPropertyOptional({
        description:
            "Immediately redirect the browser into the wallet OID4VP request",
        default: true,
    })
    @ValidateIf((o) => o.type === "oid4vp")
    @IsOptional()
    @IsBoolean()
    immediateWalletRedirect?: boolean;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    @ValidateIf(
        (o) =>
            o.type === "oid4vp" ||
            o.type === "chained" ||
            o.type === "built-in",
    )
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsTokenConfig)
    token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    @ValidateIf(
        (o) =>
            o.type === "oid4vp" ||
            o.type === "chained" ||
            o.type === "built-in",
    )
    @IsOptional()
    @IsBoolean()
    requireDPoP?: boolean;
}
