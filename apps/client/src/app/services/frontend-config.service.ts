import { Injectable } from '@angular/core';
import { appControllerGetFrontendConfig, type FrontendConfigResponseDto } from '@eudiplo/sdk-core';

export type ConfigImportMode = 'disabled' | 'create' | 'upsert' | 'replace';

export interface FrontendConfig {
  configImportMode: ConfigImportMode;
}

@Injectable({ providedIn: 'root' })
export class FrontendConfigService {
  private config: FrontendConfig | null = null;
  private configPromise: Promise<FrontendConfig | null> | null = null;

  async getConfig(): Promise<FrontendConfig | null> {
    if (this.config) return this.config;
    if (this.configPromise !== null) return this.configPromise;

    this.configPromise = appControllerGetFrontendConfig()
      .then((response) => {
        const data = response.data as FrontendConfigResponseDto | undefined;
        this.config = data?.configImportMode ? { configImportMode: data.configImportMode } : null;
        return this.config;
      })
      .catch(() => null)
      .finally(() => {
        this.configPromise = null;
      });

    return this.configPromise;
  }

  get configImportMode(): ConfigImportMode | null {
    return this.config?.configImportMode ?? null;
  }
}
