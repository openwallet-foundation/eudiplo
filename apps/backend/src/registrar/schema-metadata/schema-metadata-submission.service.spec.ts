import { BadRequestException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AttestationLoS,
    SchemaMetaBindingType,
    SchemaMetadataPinMode,
    SignSchemaMetaConfigDto,
    SignVersionSchemaMetaConfigDto,
} from "../../issuer/configuration/credentials/dto/schema-meta-config.dto";
import { SchemaMetadataSubmissionService } from "./schema-metadata-submission.service";

type MockCredentialConfig = {
    id: string;
    config: { format: "dc+sd-jwt" | "mso_mdoc"; docType?: string };
    fields: Array<Record<string, unknown>>;
    vct?: string;
    schemaMeta?: Record<string, unknown>;
};

describe("SchemaMetadataSubmissionService pinning behavior", () => {
    const tenantId = "root";
    const credentialConfigId = "pid-no-key";

    const baseConfig = {
        name: "German PID",
        version: "1.2.0",
        rulebookURI: "https://example.com/rulebook.md",
        attestationLoS: AttestationLoS.MODERATE,
        bindingType: SchemaMetaBindingType.CLAIM,
    };

    const baseCredentialConfig: MockCredentialConfig = {
        id: credentialConfigId,
        config: { format: "dc+sd-jwt" },
        vct: "urn:eudi:pid:de:1",
        fields: [
            {
                path: ["given_name"],
                type: "string",
                mandatory: true,
                disclosable: true,
            },
        ],
    };

    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                status: 200,
                headers: new Headers({
                    "content-type": "text/markdown",
                }),
                arrayBuffer: async () =>
                    new TextEncoder().encode("# Rulebook").buffer,
            })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function createService(options?: {
        existingSchemaMeta?: Record<string, unknown>;
        generatedId?: string;
    }) {
        const credentialsService = {
            getById: vi.fn(async () => ({
                ...baseCredentialConfig,
                schemaMeta: options?.existingSchemaMeta,
            })),
            update: vi.fn(async () => undefined),
        };

        const schemaMetadataService = {
            createSchemaMetadata: vi.fn(async () => ({
                id: options?.generatedId ?? "schema-new",
            })),
            getById: vi.fn(async (_tenantId: string, id: string) => ({
                id,
                version: "1.0.0",
            })),
        };

        const trustListService = {
            findOne: vi.fn(),
        };

        const keyChainService = {
            getEntity: vi.fn(),
        };

        const configService = {
            getOrThrow: vi.fn(() => "http://localhost:3000"),
        };

        const service = new SchemaMetadataSubmissionService(
            credentialsService as any,
            schemaMetadataService as any,
            trustListService as any,
            keyChainService as any,
            configService as any,
        );

        return {
            service,
            credentialsService,
            schemaMetadataService,
        };
    }

    it("blocks pin replacement on publish unless pinMode=replace_id", async () => {
        const { service, credentialsService } = createService({
            existingSchemaMeta: { id: "schema-old", version: "1.0.0" },
            generatedId: "schema-new",
        });

        const body: SignSchemaMetaConfigDto = {
            config: baseConfig,
            credentialConfigId,
        };

        await expect(service.submitSchemaMetadata(tenantId, body)).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(credentialsService.update).not.toHaveBeenCalled();
    });

    it("repoints pin on publish when pinMode=replace_id", async () => {
        const { service, credentialsService } = createService({
            existingSchemaMeta: { id: "schema-old", version: "1.0.0" },
            generatedId: "schema-new",
        });

        const body: SignSchemaMetaConfigDto = {
            config: baseConfig,
            credentialConfigId,
            pinMode: SchemaMetadataPinMode.REPLACE_ID,
        };

        await service.submitSchemaMetadata(tenantId, body);

        expect(credentialsService.update).toHaveBeenCalledTimes(1);
        expect(credentialsService.update).toHaveBeenCalledWith(
            tenantId,
            credentialConfigId,
            expect.objectContaining({
                schemaMeta: expect.objectContaining({
                    id: "schema-new",
                    version: baseConfig.version,
                }),
            }),
        );
    });

    it("updates pinned version on publish-version when pinMode=update_to_new_version", async () => {
        const { service, credentialsService } = createService({
            existingSchemaMeta: { id: "schema-1", version: "1.0.0" },
            generatedId: "schema-1",
        });

        const body: SignVersionSchemaMetaConfigDto = {
            config: {
                ...baseConfig,
                id: "schema-1",
                version: "1.1.0",
            },
            credentialConfigId,
            pinMode: SchemaMetadataPinMode.UPDATE_TO_NEW_VERSION,
        };

        await service.submitSchemaMetadataVersion(tenantId, body);

        expect(credentialsService.update).toHaveBeenCalledTimes(1);
        expect(credentialsService.update).toHaveBeenCalledWith(
            tenantId,
            credentialConfigId,
            expect.objectContaining({
                schemaMeta: expect.objectContaining({
                    id: "schema-1",
                    version: "1.1.0",
                }),
            }),
        );
    });

    it("keeps current pin on publish-version by default", async () => {
        const { service, credentialsService } = createService({
            existingSchemaMeta: { id: "schema-1", version: "1.0.0" },
            generatedId: "schema-1",
        });

        const body: SignVersionSchemaMetaConfigDto = {
            config: {
                ...baseConfig,
                id: "schema-1",
                version: "1.1.0",
            },
            credentialConfigId,
        };

        await service.submitSchemaMetadataVersion(tenantId, body);

        expect(credentialsService.update).not.toHaveBeenCalled();
    });

    it("links existing schema metadata by id without requiring name/rulebookURI", async () => {
        const { service, credentialsService, schemaMetadataService } =
            createService({
                existingSchemaMeta: undefined,
                generatedId: "schema-existing",
            });

        const body: SignSchemaMetaConfigDto = {
            config: {
                id: "schema-existing",
                version: "1.0.0",
                attestationLoS: AttestationLoS.MODERATE,
                bindingType: SchemaMetaBindingType.CLAIM,
            },
            credentialConfigId,
        };

        await service.submitSchemaMetadata(tenantId, body);

        expect(schemaMetadataService.createSchemaMetadata).not.toHaveBeenCalled();
        expect(schemaMetadataService.getById).toHaveBeenCalledWith(
            tenantId,
            "schema-existing",
        );
        expect(credentialsService.update).toHaveBeenCalledTimes(1);
        expect(credentialsService.update).toHaveBeenCalledWith(
            tenantId,
            credentialConfigId,
            expect.objectContaining({
                schemaMeta: expect.objectContaining({
                    id: "schema-existing",
                    version: "1.0.0",
                }),
            }),
        );
    });
});
