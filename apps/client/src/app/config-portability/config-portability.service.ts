import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
    private readonly http: HttpClient,
    private readonly api: ApiService,
    private readonly ownership: ConfigOwnershipService
  ) {}

  exportBundle(): Promise<ConfigBundle> {
    return firstValueFrom(this.http.get<ConfigBundle>(`${this.baseUrl}/config-bundles/export`));
  }

  exportArchive(): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/config-bundles/export`, {
        params: { format: 'zip' },
        responseType: 'blob',
      })
    );
  }

  plan(bundle: ConfigBundle, mode: ConfigImportMode): Promise<ConfigImportPlan> {
    return firstValueFrom(
      this.http.post<ConfigImportPlan>(`${this.baseUrl}/config-bundles/plan`, bundle, {
        params: { mode },
      })
    );
  }

  planArchive(file: File, mode: ConfigImportMode): Promise<ConfigImportPlan> {
    const body = new FormData();
    body.set('bundle', file);
    return firstValueFrom(
      this.http.post<ConfigImportPlan>(`${this.baseUrl}/config-bundles/plan/archive`, body, {
        params: { mode },
      })
    );
  }

  import(
    bundle: ConfigBundle,
    mode: ConfigImportMode,
    confirmReplace: boolean
  ): Promise<ConfigImportPlan> {
    return firstValueFrom(
      this.http.post<ConfigImportPlan>(`${this.baseUrl}/config-bundles/import`, bundle, {
        params: { mode, confirmReplace },
      })
    );
  }

  importArchive(
    file: File,
    mode: ConfigImportMode,
    confirmReplace: boolean
  ): Promise<ConfigImportPlan> {
    const body = new FormData();
    body.set('bundle', file);
    return firstValueFrom(
      this.http.post<ConfigImportPlan>(`${this.baseUrl}/config-bundles/import/archive`, body, {
        params: { mode, confirmReplace },
      })
    );
  }

  listResources(): Promise<ConfigResourceMetadata[]> {
    return this.ownership.list(true);
  }

  detach(kind: string, id: string): Promise<ConfigResourceMetadata> {
    return this.ownership.detach(kind as ConfigResourceKind, id);
  }

  private get baseUrl(): string {
    return (this.api.getBaseUrl() ?? '').replace(/\/$/, '');
  }
}
