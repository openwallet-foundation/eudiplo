import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles/role.enum";
import { Secured } from "../auth/secure.decorator";
import { Token, TokenPayload } from "../auth/token.decorator";
import {
    SignSchemaMetaConfigDto,
    SignVersionSchemaMetaConfigDto,
} from "../issuer/configuration/credentials/dto/schema-meta-config.dto";
import { SchemaMetadataSigningService } from "../issuer/configuration/credentials/schema-meta/schema-metadata-signing.service";
import {
    DeprecateSchemaMetadataDto,
    SchemaMetadataResponseDto,
    SchemaMetadataVocabulariesDto,
    UpdateSchemaMetadataDto,
} from "./dto/schema-metadata.dto";
import { SchemaMetadataService } from "./schema-metadata.service";

/**
 * Controller for managing TS11 schema metadata at the configured registrar /
 * catalog provider. Operations are scoped to the calling tenant; auth is
 * delegated to the registrar via the tenant's registrar credentials.
 *
 * @experimental The TS11 specification (EUDI Catalogue of Attestations) is
 * not yet finalized.
 */
@ApiTags("Schema Metadata")
@Secured([Role.Registrar])
@Controller("schema-metadata")
export class SchemaMetadataController {
    constructor(
        private readonly schemaMetadataService: SchemaMetadataService,
        private readonly schemaMetadataSigningService: SchemaMetadataSigningService,
    ) {}

    /**
     * Reserves an attestation ID at the registrar, signs the supplied
     * SchemaMetaConfig (with the reserved ID baked in as id) and submits
     * the resulting JWS to the registrar in a single call. Returns the
     * registrar SchemaMetadataResponseDto for the freshly created entry.
     *
     * If an optional credentialConfigId is provided, the reservedId is
     * written back into that credential config schemaMeta.id field so the
     * link between the two entities is queryable.
     *
     * @experimental The TS11 specification is not yet finalized.
     */
    @Post("sign")
    @Secured([Role.Issuances])
    @ApiOperation({
        summary:
            "Reserve, sign and submit a TS11 SchemaMetaConfig to the registrar",
        description:
            "Reserves an attestation ID at the configured registrar, injects it as id, signs the SchemaMetaConfig with the tenant key chain and submits the JWS to the registrar. Optionally pass credentialConfigId to link the created entry back to a credential config.",
    })
    @ApiResponse({
        status: 201,
        description:
            "Registrar metadata entry for the freshly submitted schema metadata.",
    })
    @ApiResponse({
        status: 400,
        description:
            "Invalid schema metadata or missing certificate for signing",
    })
    @ApiBody({ type: SignSchemaMetaConfigDto })
    async signSchemaMetaConfig(
        @Token() user: TokenPayload,
        @Body() body: SignSchemaMetaConfigDto,
    ) {
        return this.schemaMetadataSigningService.signSchemaMetaConfig(
            user.entity!.id,
            body,
        );
    }

    /**
     * Signs a new version of an existing SchemaMetaConfig and submits it to
     * the registrar. Unlike POST schema-metadata/sign, this endpoint does
     * NOT reserve a new attestation ID — the caller must supply the existing
     * id in the config so the registrar records the JWT as a new version
     * under the same schema.
     *
     * @experimental The TS11 specification is not yet finalized.
     */
    @Post("sign-version")
    @Secured([Role.Issuances])
    @ApiOperation({
        summary:
            "Sign and submit a new version of an existing schema metadata entry",
        description:
            "Signs the supplied SchemaMetaConfig (which must include the existing id) with the tenant key chain and submits the JWS to the registrar as a new version under the same schema ID.",
    })
    @ApiResponse({
        status: 201,
        description:
            "Registrar metadata entry for the newly submitted version.",
    })
    @ApiResponse({
        status: 400,
        description: "config.id is required; or invalid schema metadata",
    })
    @ApiBody({ type: SignVersionSchemaMetaConfigDto })
    async signVersionSchemaMetaConfig(
        @Token() user: TokenPayload,
        @Body() body: SignVersionSchemaMetaConfigDto,
    ) {
        return this.schemaMetadataSigningService.signVersionSchemaMetaConfig(
            user.entity!.id,
            body,
        );
    }

    @Get("vocabularies")
    @ApiOperation({ summary: "Get predefined schema metadata vocabularies" })
    @ApiResponse({ status: 200, type: SchemaMetadataVocabulariesDto })
    getVocabularies(
        @Token() token: TokenPayload,
    ): Promise<SchemaMetadataVocabulariesDto> {
        return this.schemaMetadataService.getVocabularies(token.entity!.id);
    }

    @Get()
    @ApiOperation({ summary: "List schema metadata" })
    @ApiResponse({ status: 200, type: [SchemaMetadataResponseDto] })
    findAll(
        @Token() token: TokenPayload,
        @Query("attestationId") attestationId?: string,
        @Query("version") version?: string,
    ): Promise<SchemaMetadataResponseDto[]> {
        return this.schemaMetadataService.findAll(token.entity!.id, {
            attestationId,
            version,
        });
    }

    @Get("mine")
    @ApiOperation({ summary: "List schema metadata controlled by the user" })
    @ApiResponse({ status: 200, type: [SchemaMetadataResponseDto] })
    getMine(
        @Token() token: TokenPayload,
    ): Promise<SchemaMetadataResponseDto[]> {
        return this.schemaMetadataService.getMine(token.entity!.id);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get schema metadata by ID" })
    @ApiResponse({ status: 200, type: SchemaMetadataResponseDto })
    findOne(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<SchemaMetadataResponseDto> {
        return this.schemaMetadataService.findOne(token.entity!.id, id);
    }

    @Patch(":id/versions/:version")
    @ApiOperation({ summary: "Update schema metadata attributes" })
    @ApiBody({ type: UpdateSchemaMetadataDto })
    @ApiResponse({ status: 200, type: SchemaMetadataResponseDto })
    update(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
        @Body() body: UpdateSchemaMetadataDto,
    ): Promise<SchemaMetadataResponseDto> {
        return this.schemaMetadataService.updateMetadata(
            token.entity!.id,
            id,
            version,
            body,
        );
    }

    @Delete(":id/versions/:version")
    @ApiOperation({ summary: "Delete schema metadata" })
    @ApiResponse({ status: 200, description: "Deleted" })
    remove(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
    ): Promise<void> {
        return this.schemaMetadataService.remove(token.entity!.id, id, version);
    }

    @Get(":id/latest")
    @ApiOperation({ summary: "Get latest version of schema metadata by ID" })
    @ApiResponse({ status: 200, type: SchemaMetadataResponseDto })
    getLatest(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<SchemaMetadataResponseDto> {
        return this.schemaMetadataService.getLatest(token.entity!.id, id);
    }

    @Get(":id/versions")
    @ApiOperation({ summary: "List all versions of a schema metadata entry" })
    @ApiResponse({ status: 200, type: [SchemaMetadataResponseDto] })
    getVersions(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<SchemaMetadataResponseDto[]> {
        return this.schemaMetadataService.getVersions(token.entity!.id, id);
    }

    @Get(":id/versions/:version/jwt")
    @ApiOperation({ summary: "Get signed schema metadata JWT" })
    @ApiResponse({
        status: 200,
        description: "Compact-serialization JWS string",
        schema: { type: "string" },
    })
    getJwt(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
    ): Promise<string> {
        return this.schemaMetadataService.getSignedJwt(
            token.entity!.id,
            id,
            version,
        );
    }

    @Get(":id/versions/:version/export")
    @ApiOperation({ summary: "Export schema metadata in catalog format" })
    @ApiResponse({
        status: 200,
        description: "Registrar-defined catalog document",
        schema: { type: "object", additionalProperties: true },
    })
    export(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
    ): Promise<unknown> {
        return this.schemaMetadataService.exportCatalogFormat(
            token.entity!.id,
            id,
            version,
        );
    }

    @Get(":id/versions/:version/schemas/:format")
    @ApiOperation({ summary: "Get schema content for a specific format" })
    @ApiResponse({
        status: 200,
        description: "JSON Schema document for the requested format",
        schema: { type: "object", additionalProperties: true },
    })
    getSchema(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
        @Param("format") format: string,
    ): Promise<unknown> {
        return this.schemaMetadataService.getSchemaByFormat(
            token.entity!.id,
            id,
            version,
            format,
        );
    }

    @Patch(":id/versions/:version/deprecation")
    @ApiOperation({ summary: "Deprecate a schema metadata version" })
    @ApiBody({ type: DeprecateSchemaMetadataDto })
    @ApiResponse({ status: 200, type: SchemaMetadataResponseDto })
    deprecateVersion(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("version") version: string,
        @Body() body: DeprecateSchemaMetadataDto,
    ): Promise<SchemaMetadataResponseDto> {
        return this.schemaMetadataService.deprecateVersion(
            token.entity!.id,
            id,
            version,
            body,
        );
    }
}
