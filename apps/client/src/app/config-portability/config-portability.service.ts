import { Injectable } from '@angular/core';
import {
  configPortabilityControllerExport,
  configPortabilityControllerImport,
  configPortabilityControllerImportArchive,
  configPortabilityControllerPlan,
  configPortabilityControllerPlanArchive,
} from '@eudiplo/sdk-core';
import { ApiService } from '../core';
import {
  ConfigOwnershipService,
  ConfigResourceMetadata,
  ConfigResourceKind,
} from './config-ownership.service';

export type { ConfigResourceMetadata } from './config-ownership.service';

export type ConfigImportMode = 'create' | 'upsert' | 'replace';

interface ConfigDocument {
  apiVersion: string;
  kind: string;
  metadata: { id: string; generation?: number; ownership?: string };
  spec: Record<string, unknown>;
}

export interface ConfigBundle {
  manifest: {
    format: string;
    formatVersion: number;
    sourceVersion: string;
    exportedAt: string;
    tenant: string;
    resources: unknown[];
    requirements: unknown[];
    warnings: unknown[];
  };
  documents: ConfigDocument[];
  assets: unknown[];
}

interface ConfigPlanIssue {
  severity: 'warning' | 'required-input' | 'error';
  code: string;
  path: string;
  message: string;
}

interface ConfigPlanItem {
  kind: string;
  id: string;
  action: 'create' | 'update' | 'skip' | 'delete' | 'blocked';
  sourceVersion: string;
  targetVersion: string;
  migrations: string[];
  issues: ConfigPlanIssue[];
}

export interface ConfigImportPlan {
  tenantId: string;
  mode: ConfigImportMode;
  applicable: boolean;
  items: ConfigPlanItem[];
  issues: ConfigPlanIssue[];
  generatedSecrets?: {
    kind: 'Client';
    id: string;
    path: '/spec/secret';
    value: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class ConfigPortabilityService {
  constructor(
    private readonly api: ApiService,
    private readonly ownership: ConfigOwnershipService
  ) {}

  async exportBundle(): Promise<ConfigBundle> {
    const result = await configPortabilityControllerExport<true>({ client: this.api.client });
    return result.data as unknown as ConfigBundle;
  }

  async exportArchive(): Promise<Blob> {
    const result = await configPortabilityControllerExport<true>({
      client: this.api.client,
      query: { format: 'zip' },
      parseAs: 'blob',
    });
    return result.data as unknown as Blob;
  }

  async plan(bundle: ConfigBundle, mode: ConfigImportMode): Promise<ConfigImportPlan> {
    const result = await configPortabilityControllerPlan<true>({
      client: this.api.client,
      body: bundle,
      query: { mode },
    } as never);
    return result.data as unknown as ConfigImportPlan;
  }

  async planArchive(file: File, mode: ConfigImportMode): Promise<ConfigImportPlan> {
    const body = new FormData();
    body.set('bundle', file);
    const result = await configPortabilityControllerPlanArchive<true>({
      client: this.api.client,
      body,
      query: { mode },
    } as never);
    return result.data as unknown as ConfigImportPlan;
  }

  import(
    bundle: ConfigBundle,
    mode: ConfigImportMode,
    confirmReplace: boolean
  ): Promise<ConfigImportPlan> {
    return configPortabilityControllerImport<true>({
      client: this.api.client,
      body: bundle,
      query: { mode, confirmReplace },
    } as never).then((result) => result.data as unknown as ConfigImportPlan);
  }

  importArchive(
    file: File,
    mode: ConfigImportMode,
    confirmReplace: boolean
  ): Promise<ConfigImportPlan> {
    const body = new FormData();
    body.set('bundle', file);
    return configPortabilityControllerImportArchive<true>({
      client: this.api.client,
      body,
      query: { mode, confirmReplace },
    } as never).then((result) => result.data as unknown as ConfigImportPlan);
  }

  listResources(): Promise<ConfigResourceMetadata[]> {
    return this.ownership.list(true);
  }

  detach(kind: string, id: string): Promise<ConfigResourceMetadata> {
    return this.ownership.detach(kind as ConfigResourceKind, id);
  }
}
