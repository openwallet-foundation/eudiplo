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
    return firstValueFrom(
      this.http.post<ResolvedSchemaMetadata>(endpoint, {
        schemaMetadataUrl,
      })
    );
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

  generateDcqlQuery(resolved: ResolvedSchemaMetadata, selectedFormats: string[]): object {
    const baseId = this.deriveSchemaKey(resolved.schema.id);
    const trustedAuthorities = this.toDcqlTrustedAuthorities(resolved);
    const credentials = selectedFormats.map((format, index) => {
      const formatKey = this.sanitizeId(format).slice(0, 20) || 'cred';
      const credential: Record<string, unknown> = {
        id: `${baseId}_${formatKey}_${index + 1}`,
        format,
      };

      if (format === 'dc+sd-jwt') {
        credential['meta'] = {
          vct_values: [resolved.schema.id],
        };
      }

      if (trustedAuthorities.length > 0) {
        credential['trusted_authorities'] = trustedAuthorities;
      }

      return credential;
    });

    return { credentials };
  }

  generateImportResult(
    resolved: ResolvedSchemaMetadata,
    selectedFormats: string[]
  ): SchemaMetadataImportResult {
    const dcqlQuery = this.generateDcqlQuery(resolved, selectedFormats);
    const suggestedPresentationId = this.derivePresentationId(resolved);
    const suggestedDescription = this.deriveDescription(resolved);

    return {
      dcqlQuery,
      suggestedPresentationId,
      suggestedDescription,
    };
  }

  private toDcqlTrustedAuthorities(
    resolved: ResolvedSchemaMetadata
  ): { type: 'aki' | 'etsi_tl'; values: string[] }[] {
    const valuesByType = new Map<'aki' | 'etsi_tl', Set<string>>();

    for (const authority of resolved.schema.trustedAuthorities ?? []) {
      const frameworkType = authority.frameworkType;
      const value = authority.value;

      if ((frameworkType !== 'aki' && frameworkType !== 'etsi_tl') || !value) {
        continue;
      }

      if (!valuesByType.has(frameworkType)) {
        valuesByType.set(frameworkType, new Set<string>());
      }
      valuesByType.get(frameworkType)!.add(value);
    }

    return Array.from(valuesByType.entries()).map(([type, values]) => ({
      type,
      values: Array.from(values),
    }));
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

  private deriveSchemaKey(schemaId: string): string {
    const tail = schemaId.split('/').filter(Boolean).pop() || schemaId;
    return this.sanitizeId(tail).slice(0, 30) || 'schema';
  }

  private derivePresentationId(resolved: ResolvedSchemaMetadata): string {
    const source = resolved.schema.name || this.deriveSchemaKey(resolved.schema.id);
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
