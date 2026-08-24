import { Injectable } from '@angular/core';
import {
  configPortabilityControllerDetach,
  configPortabilityControllerResources,
  type ConfigResourceMetadataEntity,
} from '@eudiplo/sdk-core';
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

  constructor(private readonly api: ApiService) {}

  list(force = false): Promise<ConfigResourceMetadata[]> {
    if (force || !this.resources) {
      this.resources = configPortabilityControllerResources<true>({ client: this.api.client })
        .then((result) => result.data as ConfigResourceMetadata[])
        .catch((error: unknown) => {
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
    const result = await configPortabilityControllerDetach<true>({
      client: this.api.client,
      path: { kind, id: resourceId },
    });
    const metadata = result.data as ConfigResourceMetadataEntity as ConfigResourceMetadata;
    await this.list(true);
    return metadata;
  }

  invalidate(): void {
    this.resources = undefined;
  }
}
