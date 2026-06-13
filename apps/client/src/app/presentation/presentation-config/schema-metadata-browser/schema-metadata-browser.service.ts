import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core';

export interface ResolvedSchemaMetadata {
  signedJwt: string;
  schema: {
    id: string;
    version?: string;
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    supportedFormats: string[];
    schemaURIs: {
      formatIdentifier?: string;
      format?: string;
      uri?: string;
    }[];
    trustedAuthorities: {
      frameworkType?: string;
      value?: string;
      isLoTE?: boolean;
    }[];
    resolvedReferences?: {
      format: string;
      uri: string;
      integrity?: string;
      meta?: Record<string, unknown>;
      parsedSchema?: Record<string, unknown>;
    }[];
    dcqlQuery?: object;
  };
}

export interface SchemaMetadataImportResult {
  dcqlQuery: object;
  suggestedPresentationId?: string;
  suggestedDescription?: string;
}

export interface CatalogEntry {
  id: string;
  version: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  supportedFormats: string[];
  schemaURIs: { formatIdentifier?: string; format?: string; uri?: string }[];
  trustedAuthorities: { frameworkType?: string; value?: string; isLoTE?: boolean }[];
  signedJwt: string;
  issuer: string;
  signerCertificateSerial: string;
}

@Injectable()
export class SchemaMetadataBrowserService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiService: ApiService
  ) {}

  async fetchSchemaMetadata(schemaMetadataUrl: string): Promise<ResolvedSchemaMetadata> {
    const baseUrl = this.apiService.getBaseUrl();
    if (!baseUrl) {
      throw new Error('API base URL is not configured. Please log in again.');
    }

    const endpoint = `${baseUrl}/api/verifier/config/schema-metadata/resolve`;
    return firstValueFrom(this.http.post<ResolvedSchemaMetadata>(endpoint, { schemaMetadataUrl }));
  }

  async fetchCatalog(): Promise<CatalogEntry[]> {
    const baseUrl = this.apiService.getBaseUrl();
    if (!baseUrl) {
      throw new Error('API base URL is not configured. Please log in again.');
    }

    const endpoint = `${baseUrl}/api/verifier/config/schema-metadata/catalog`;
    return firstValueFrom(this.http.get<CatalogEntry[]>(endpoint));
  }

  catalogEntryToResolved(entry: CatalogEntry): ResolvedSchemaMetadata {
    return {
      signedJwt: entry.signedJwt,
      schema: {
        id: entry.id,
        version: entry.version,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        tags: entry.tags,
        supportedFormats: entry.supportedFormats,
        schemaURIs: entry.schemaURIs,
        trustedAuthorities: entry.trustedAuthorities,
      },
    };
  }

  generateImportResult(
    resolved: ResolvedSchemaMetadata,
    selectedFormats: string[]
  ): SchemaMetadataImportResult {
    const allCredentials =
      (resolved.schema.dcqlQuery as { credentials?: Record<string, unknown>[] } | undefined)
        ?.credentials ?? [];
    const selected = new Set(selectedFormats);
    const credentials = allCredentials.filter((credential) => {
      const format = credential['format'];
      return typeof format === 'string' && selected.has(format);
    });

    const dcqlQuery = { credentials };
    const suggestedPresentationId = this.derivePresentationId(resolved);
    const suggestedDescription = this.deriveDescription(resolved);

    return {
      dcqlQuery,
      suggestedPresentationId,
      suggestedDescription,
    };
  }

  private sanitizeId(value: string): string {
    return (
      (value || 'schema')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_/, '')
        .replace(/_$/, '')
        .slice(0, 50) || 'schema'
    );
  }

  private derivePresentationId(resolved: ResolvedSchemaMetadata): string {
    const source = resolved.schema.name || resolved.schema.id;
    const version = resolved.schema.version
      ? `_v${resolved.schema.version.replace(/[^0-9a-zA-Z]+/g, '_')}`
      : '';
    return `${this.sanitizeId(source)}${version}`;
  }

  private deriveDescription(resolved: ResolvedSchemaMetadata): string {
    if (resolved.schema.description) {
      return resolved.schema.description;
    }

    const label = resolved.schema.name || resolved.schema.id;
    const versionSuffix = resolved.schema.version ? ` (v${resolved.schema.version})` : '';
    return `Imported from schema metadata ${label}${versionSuffix}`;
  }
}
