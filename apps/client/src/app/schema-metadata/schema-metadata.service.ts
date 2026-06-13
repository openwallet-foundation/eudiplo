import { Injectable } from '@angular/core';
import {
  schemaMetadataControllerDeprecateVersion,
  schemaMetadataControllerExport,
  schemaMetadataControllerFindAll,
  schemaMetadataControllerGetMine,
  schemaMetadataControllerFindOne,
  schemaMetadataControllerGetJwt,
  schemaMetadataControllerGetLatest,
  schemaMetadataControllerGetVocabularies,
  schemaMetadataControllerGetVersions,
  schemaMetadataControllerRemove,
  schemaMetadataControllerSignSchemaMetaConfig,
  schemaMetadataControllerSignVersionSchemaMetaConfig,
  schemaMetadataControllerUpdate,
  type DeprecateSchemaMetadataDto,
  type SchemaMetaConfig,
  type SchemaMetadataResponseDto,
  type SchemaMetadataVocabulariesDto,
  type UpdateSchemaMetadataDto,
} from '@eudiplo/sdk-core';

/**
 * Re-exports of schema-metadata DTOs from the generated SDK.
 */
export type SchemaMetadata = SchemaMetadataResponseDto;
export type SchemaMetadataVocabularies = SchemaMetadataVocabulariesDto;

@Injectable({
  providedIn: 'root',
})
export class SchemaMetadataService {
  async getVocabularies(): Promise<SchemaMetadataVocabularies> {
    const response = await schemaMetadataControllerGetVocabularies();

    return response.data as SchemaMetadataVocabularies;
  }

  async list(params?: { attestationId?: string; version?: string }): Promise<SchemaMetadata[]> {
    const response = await schemaMetadataControllerFindAll({
      query: {
        ...(params?.attestationId ? { attestationId: params.attestationId } : {}),
        ...(params?.version ? { version: params.version } : {}),
      },
    });

    return response.data ?? [];
  }

  async listMine(): Promise<SchemaMetadata[]> {
    const response = await schemaMetadataControllerGetMine();

    return response.data ?? [];
  }

  async getById(id: string): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerFindOne({
      path: { id },
    });

    return response.data as SchemaMetadata;
  }

  async updateMetadata(
    id: string,
    version: string,
    body: UpdateSchemaMetadataDto
  ): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerUpdate({
      path: { id, version },
      body,
    });

    return response.data as SchemaMetadata;
  }

  async delete(id: string, version: string): Promise<void> {
    await schemaMetadataControllerRemove({
      path: { id, version },
    });
  }

  async getSignedJwt(id: string, version: string): Promise<string> {
    const response = await schemaMetadataControllerGetJwt({
      path: { id, version },
    });

    return response.data as string;
  }

  async exportCatalog(id: string, version: string): Promise<unknown> {
    const response = await schemaMetadataControllerExport({
      path: { id, version },
    });

    return response.data;
  }

  async getLatest(id: string): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerGetLatest({
      path: { id },
    });

    return response.data as SchemaMetadata;
  }

  async getVersions(id: string): Promise<SchemaMetadata[]> {
    const response = await schemaMetadataControllerGetVersions({
      path: { id },
    });

    return (response.data ?? []) as SchemaMetadata[];
  }

  async deprecateVersion(
    id: string,
    version: string,
    body: DeprecateSchemaMetadataDto
  ): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerDeprecateVersion({
      path: { id, version },
      body,
    });

    return response.data as SchemaMetadata;
  }

  /**
   * Signs the supplied SchemaMetaConfig (with the existing `id` already set)
   * and submits it to the registrar as a new version. The backend recomputes
   * SRI hashes server-side, so `rulebookIntegrity` does not need to be
   * provided by the caller.
   */
  async publishNewVersion(config: SchemaMetaConfig, keyChainId?: string): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerSignVersionSchemaMetaConfig({
      body: { config, ...(keyChainId ? { keyChainId } : {}) },
    });

    return response.data as SchemaMetadata;
  }

  /**
   * Reserve an attestation id at the registrar, sign the supplied
   * SchemaMetaConfig (with the reserved id baked in as `id`) and submit
   * the JWS to the registrar in a single backend round-trip. Returns the
   * registrar's metadata entry for the freshly created attestation.
   *
   * `keyChainId` is optional (defaults to the tenant's default key chain).
   */
  async signSchemaMetaConfig(
    config: Omit<SchemaMetaConfig, 'id'>,
    keyChainId?: string,
    credentialConfigId?: string
  ): Promise<SchemaMetadata> {
    const response = await schemaMetadataControllerSignSchemaMetaConfig({
      body: {
        config,
        ...(keyChainId ? { keyChainId } : {}),
        ...(credentialConfigId ? { credentialConfigId } : {}),
      },
    });

    return response.data as SchemaMetadata;
  }
}
