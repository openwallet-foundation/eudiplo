import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import {
    DeprecateSchemaMetadataDto,
    UpdateSchemaMetadataDto,
} from "./dto/schema-metadata.dto";
import {
    type ReservationResponseDto,
    type SchemaMetadata,
    type SchemaMetadataVocabulariesDto,
    schemaMetadataControllerExport,
    schemaMetadataControllerFindAll,
    schemaMetadataControllerFindOne,
    schemaMetadataControllerGetLatestVersionInfo,
    schemaMetadataControllerGetSchema,
    schemaMetadataControllerGetSignedJwt,
    schemaMetadataControllerGetVocabularies,
    schemaMetadataControllerListVersions,
    schemaMetadataControllerRemove,
    schemaMetadataControllerReserveSchemaId,
    schemaMetadataControllerSetVersionDeprecation,
    schemaMetadataControllerSubmitSchemaMetadata,
    schemaMetadataControllerUpdateMetadata,
    schemaMetadataControllerUploadAsset,
    type UploadAssetResponseDto,
    schemaMetadataControllerFindAllByRelyingParty,
} from "./generated";
import { RegistrarAuthService } from "./registrar-auth.service";

type SchemaMetadataFilters = {
    attestationId?: string;
    version?: string;
};

type UploadAssetType = "trustlists" | "rulebooks" | "schemas";

@Injectable()
export class SchemaMetadataService {
    private readonly logger = new Logger(SchemaMetadataService.name);

    constructor(private readonly authService: RegistrarAuthService) {}

    async uploadAsset(
        tenantId: string,
        type: UploadAssetType,
        file: Blob | File,
    ): Promise<UploadAssetResponseDto> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerUploadAsset({
            client,
            path: { type },
            body: { file },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                `upload ${type} asset`,
                res.error,
            );
        }

        return res.data!;
    }

    async uploadAssetFromUrl(
        tenantId: string,
        type: UploadAssetType,
        sourceUrl: string,
        fallbackFileName: string,
    ): Promise<UploadAssetResponseDto> {
        let response: Response;
        try {
            response = await fetch(sourceUrl);
        } catch (error) {
            throw new BadRequestException(
                `Failed to fetch ${type} source (${sourceUrl}) for registrar upload: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }

        if (!response.ok) {
            throw new BadRequestException(
                `Failed to fetch ${type} source (${sourceUrl}) for registrar upload: HTTP ${response.status}`,
            );
        }

        const contentType =
            response.headers.get("content-type") || "application/octet-stream";
        const bytes = await response.arrayBuffer();

        const parsedName = (() => {
            try {
                const pathname = new URL(sourceUrl).pathname;
                const last = pathname.split("/").filter(Boolean).pop();
                return last || fallbackFileName;
            } catch {
                return fallbackFileName;
            }
        })();

        const file =
            typeof File === "function"
                ? new File([bytes], parsedName, { type: contentType })
                : (new Blob([bytes], {
                      type: contentType,
                  }) as Blob | File);

        return this.uploadAsset(tenantId, type, file);
    }

    async reserveSchemaId(
        tenantId: string,
        nameHint?: string,
    ): Promise<ReservationResponseDto> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerReserveSchemaId({
            client,
            body: nameHint ? { nameHint } : {},
        });

        if (res.error) {
            this.throwUpstreamError(tenantId, "reserve schema id", res.error);
        }

        return res.data!;
    }

    async getVocabularies(
        tenantId: string,
    ): Promise<SchemaMetadataVocabulariesDto> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerGetVocabularies({ client });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "get schema metadata vocabularies",
                res.error,
            );
        }

        return res.data!;
    }

    async getMine(tenantId: string): Promise<SchemaMetadata[]> {
        const client = await this.authService.getClient(tenantId);
        const rpId = await this.authService.getRelyingPartyId(tenantId);
        const res = await schemaMetadataControllerFindAllByRelyingParty({
            client,
            path: {
                rpId,
            },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "list own schema metadata",
                res.error,
            );
        }
        return res.data ?? [];
    }

    async findAll(
        tenantId: string,
        filters: SchemaMetadataFilters,
    ): Promise<SchemaMetadata[]> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerFindAll({
            client,
            query: {
                ...(filters.attestationId ? { id: filters.attestationId } : {}),
                ...(filters.version ? { version: filters.version } : {}),
            },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "list schema metadata",
                res.error,
            );
        }

        return res.data ?? [];
    }

    async submitSignedSchemaMetadata(
        tenantId: string,
        signedJwt: string,
    ): Promise<SchemaMetadata> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerSubmitSchemaMetadata({
            client,
            body: { jwt: signedJwt },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "submit schema metadata",
                res.error,
            );
        }

        return res.data!;
    }

    async findOne(tenantId: string, id: string): Promise<SchemaMetadata> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerFindOne({
            client,
            path: { id },
        });

        if (res.error) {
            this.throwUpstreamError(tenantId, "get schema metadata", res.error);
        }

        return res.data!;
    }

    async updateMetadata(
        tenantId: string,
        id: string,
        version: string,
        dto: UpdateSchemaMetadataDto,
    ): Promise<SchemaMetadata> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerUpdateMetadata({
            client,
            path: { id, version },
            body: dto,
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "update schema metadata",
                res.error,
            );
        }

        return res.data!;
    }

    async remove(tenantId: string, id: string, version: string): Promise<void> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerRemove({
            client,
            path: { id, version },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "delete schema metadata",
                res.error,
            );
        }
    }

    async getSignedJwt(
        tenantId: string,
        id: string,
        version: string,
    ): Promise<string> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerGetSignedJwt({
            client,
            path: { id, version },
            parseAs: "text",
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "get signed schema metadata jwt",
                res.error,
            );
        }

        return res.data as string;
    }

    async exportCatalogFormat(
        tenantId: string,
        id: string,
        version: string,
    ): Promise<unknown> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerExport({
            client,
            path: { id, version },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "export schema metadata",
                res.error,
            );
        }

        return res.data;
    }

    async getSchemaByFormat(
        tenantId: string,
        id: string,
        version: string,
        format: string,
    ): Promise<unknown> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerGetSchema({
            client,
            path: { id, version, format },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "get schema metadata schema",
                res.error,
            );
        }

        return res.data;
    }

    async getLatest(tenantId: string, id: string): Promise<SchemaMetadata> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerGetLatestVersionInfo({
            client,
            path: { id },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "get latest schema metadata",
                res.error,
            );
        }

        return res.data as SchemaMetadata;
    }

    async getVersions(tenantId: string, id: string): Promise<SchemaMetadata[]> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerListVersions({
            client,
            path: { id },
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "list schema metadata versions",
                res.error,
            );
        }

        return (res.data ?? []) as SchemaMetadata[];
    }

    async deprecateVersion(
        tenantId: string,
        id: string,
        version: string,
        dto: DeprecateSchemaMetadataDto,
    ): Promise<SchemaMetadata> {
        const client = await this.authService.getClient(tenantId);
        const res = await schemaMetadataControllerSetVersionDeprecation({
            client,
            path: { id, version },
            body: dto,
        });

        if (res.error) {
            this.throwUpstreamError(
                tenantId,
                "deprecate schema metadata version",
                res.error,
            );
        }

        return res.data!;
    }

    private throwUpstreamError(
        tenantId: string,
        action: string,
        error: unknown,
    ): never {
        const statusCode = Number(
            (error as any)?.status ?? (error as any)?.statusCode,
        );
        const message =
            (error as any)?.error?.message ??
            (error as any)?.message ??
            (error as any)?.error ??
            "Unknown registrar error";

        this.logger.error(
            { tenantId, action, statusCode, error },
            `Failed to ${action}`,
        );

        if (statusCode === 404) {
            throw new NotFoundException(message);
        }

        if (statusCode === 403) {
            throw new ForbiddenException(message);
        }

        if (statusCode === 400 || statusCode === 401 || statusCode === 409) {
            throw new BadRequestException(message);
        }

        throw new InternalServerErrorException(message);
    }
}
