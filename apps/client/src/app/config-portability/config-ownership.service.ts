import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core';

export type ConfigResourceKind =
  | 'Tenant'
  | 'Client'
  | 'KmsConfig'
  | 'KeyChain'
  | 'RegistrarConfig'
  | 'IssuanceConfig'
  | 'CredentialConfig'
  | 'PresentationConfig'
  | 'AttributeProvider'
  | 'WebhookEndpoint'
  | 'TrustList'
  | 'StatusList';

export interface ConfigResourceMetadata {
  tenantId: string;
  kind: ConfigResourceKind;
  resourceId: string;
  ownership: 'unmanaged' | 'file-managed';
  generation: number;
  source?: string;
  lastAppliedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigOwnershipService {
  private resources?: Promise<ConfigResourceMetadata[]>;

  constructor(
    private readonly http: HttpClient,
    private readonly api: ApiService
  ) {}

  list(force = false): Promise<ConfigResourceMetadata[]> {
    if (force || !this.resources) {
      this.resources = firstValueFrom(
        this.http.get<ConfigResourceMetadata[]>(`${this.baseUrl}/config-bundles/resources`)
      ).catch((error) => {
        this.resources = undefined;
        throw error;
      });
    }
    return this.resources;
  }

  async get(
    kind: ConfigResourceKind,
    resourceId: string
  ): Promise<ConfigResourceMetadata | undefined> {
    return (await this.list()).find(
      (resource) => resource.kind === kind && resource.resourceId === resourceId
    );
  }

  async isManaged(kind: ConfigResourceKind, resourceId: string): Promise<boolean> {
    return (await this.get(kind, resourceId))?.ownership === 'file-managed';
  }

  async detach(kind: ConfigResourceKind, resourceId: string): Promise<ConfigResourceMetadata> {
    const metadata = await firstValueFrom(
      this.http.post<ConfigResourceMetadata>(
        `${this.baseUrl}/config-bundles/resources/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}/detach`,
        {}
      )
    );
    await this.list(true);
    return metadata;
  }

  invalidate(): void {
    this.resources = undefined;
  }

  private get baseUrl(): string {
    return (this.api.getBaseUrl() ?? '').replace(/\/$/, '');
  }
}
