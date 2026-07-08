import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    IsUrl,
    ValidateNested,
} from "class-validator";
import {
    ChainedAsTokenConfig,
    UpstreamOidcConfig,
} from "./chained-as-config.dto";

export type AuthorizationServerType =
    | "external"
    | "oid4vp"
    | "chained"
    | "built-in";

export class ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["external", "oid4vp", "chained", "built-in"],
        example: "external",
    })
    @IsString()
    @IsIn(["external", "oid4vp", "chained", "built-in"])
    type!: AuthorizationServerType;

    @ApiPropertyOptional({
        description: "Human-friendly label for the UI",
        example: "PID Authorization Server",
    })
    @IsOptional()
    @IsString()
    label?: string;

    @ApiPropertyOptional({
        description: "Whether this managed authorization server is enabled",
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;
}

export class ExternalAuthorizationServerConfig extends ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["external"],
        example: "external",
    })
    @IsString()
    @IsIn(["external"])
    declare type: "external";

    @ApiProperty({
        description: "Issuer URL for external authorization servers",
        example: "https://auth.example.com",
    })
    @IsUrl({ require_tld: false })
    declare issuer: string;
}

export class Oid4VpAuthorizationServerConfig extends ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["oid4vp"],
        example: "oid4vp",
    })
    @IsString()
    @IsIn(["oid4vp"])
    declare type: "oid4vp";

    @ApiProperty({
        description: "Stable identifier used in the AS URL path",
        example: "pid-auth",
    })
    @IsString()
    declare id: string;

    @ApiProperty({
        description: "Presentation configuration ID to use for OID4VP",
        example: "playground-pid",
    })
    @IsString()
    declare presentationConfigId: string;

    @ApiPropertyOptional({
        description:
            "Immediately redirect the browser into the wallet OID4VP request",
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    declare immediateWalletRedirect?: boolean;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsTokenConfig)
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    declare requireDPoP?: boolean;
}

export class ChainedAuthorizationServerConfig extends ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["chained"],
        example: "chained",
    })
    @IsString()
    @IsIn(["chained"])
    declare type: "chained";

    @ApiProperty({
        description: "Upstream OIDC provider configuration for chained mode",
        type: () => UpstreamOidcConfig,
    })
    @ValidateNested()
    @Type(() => UpstreamOidcConfig)
    declare upstream: UpstreamOidcConfig;

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsTokenConfig)
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    declare requireDPoP?: boolean;
}

export class BuiltInAuthorizationServerConfig extends ManagedAuthorizationServerConfig {
    @ApiProperty({
        description: "Authorization server implementation type",
        enum: ["built-in"],
        example: "built-in",
    })
    @IsString()
    @IsIn(["built-in"])
    declare type: "built-in";

    @ApiPropertyOptional({
        description: "Token configuration for this authorization server",
        type: () => ChainedAsTokenConfig,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => ChainedAsTokenConfig)
    declare token?: ChainedAsTokenConfig;

    @ApiPropertyOptional({
        description:
            "Require DPoP for token requests issued by this authorization server",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    declare requireDPoP?: boolean;
}
