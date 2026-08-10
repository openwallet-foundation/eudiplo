import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResolvedSchemaMetadataReferenceDto {
    @ApiProperty({ description: "Resolved reference format" })
    format!: string;

    @ApiProperty({ description: "Resolved reference URI" })
    uri!: string;

    @ApiPropertyOptional({ description: "Integrity hash for the reference" })
    integrity?: string;

    @ApiPropertyOptional({
        type: "object",
        additionalProperties: true,
        description: "Additional metadata attached to the reference",
    })
    meta?: Record<string, unknown>;

    @ApiPropertyOptional({
        type: "object",
        additionalProperties: true,
        description: "Parsed schema document for the reference",
    })
    parsedSchema?: Record<string, unknown>;
}

export class ResolvedSchemaMetadataSchemaUriDto {
    @ApiPropertyOptional({ description: "Optional format identifier" })
    formatIdentifier?: string;

    @ApiProperty({ description: "Schema URI" })
    uri!: string;
}

export class ResolvedSchemaMetadataTrustedAuthorityDto {
    @ApiPropertyOptional({ description: "Trust framework type" })
    frameworkType?: string;

    @ApiPropertyOptional({ description: "Trust-framework-specific value" })
    value?: string;

    @ApiPropertyOptional({ description: "Whether the authority is LoTE" })
    isLoTE?: boolean;
}

export class ResolvedSchemaMetadataSchemaDto {
    @ApiProperty({ description: "Schema metadata identifier" })
    id!: string;

    @ApiPropertyOptional({ description: "Schema metadata version" })
    version?: string;

    @ApiPropertyOptional({ description: "Human-readable name" })
    name?: string;

    @ApiPropertyOptional({ description: "Human-readable description" })
    description?: string;

    @ApiPropertyOptional({ description: "Category label" })
    category?: string;

    @ApiPropertyOptional({ type: [String], description: "Free-form tags" })
    tags?: string[];

    @ApiProperty({
        type: [String],
        description: "Supported credential formats",
    })
    supportedFormats!: string[];

    @ApiProperty({
        type: [ResolvedSchemaMetadataSchemaUriDto],
        description: "Resolved schema URIs",
    })
    schemaURIs!: ResolvedSchemaMetadataSchemaUriDto[];

    @ApiProperty({
        type: [ResolvedSchemaMetadataTrustedAuthorityDto],
        description: "Trusted authorities resolved from the schema metadata",
    })
    trustedAuthorities!: ResolvedSchemaMetadataTrustedAuthorityDto[];

    @ApiProperty({
        type: [ResolvedSchemaMetadataReferenceDto],
        description: "Resolved referenced schemas",
    })
    resolvedReferences!: ResolvedSchemaMetadataReferenceDto[];

    @ApiProperty({
        type: "object",
        additionalProperties: true,
        description: "Derived DCQL query",
    })
    dcqlQuery!: Record<string, unknown>;
}

export class ResolvedSchemaMetadataResponseDto {
    @ApiProperty({ description: "Signed JWT returned by the resolver" })
    signedJwt!: string;

    @ApiProperty({ type: ResolvedSchemaMetadataSchemaDto })
    schema!: ResolvedSchemaMetadataSchemaDto;
}
