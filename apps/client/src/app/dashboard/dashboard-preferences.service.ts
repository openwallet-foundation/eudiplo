import { Injectable } from '@angular/core';

import { ApiService } from '../core';
import { JwtService } from '../services/jwt.service';

export type DashboardFocus = 'balanced' | 'issuance' | 'verification' | 'operations';
export type DashboardSection = 'recentActivity' | 'sessionOverview' | 'quickActions' | 'resources';

export interface DashboardPreferences {
  focus: DashboardFocus;
  visibleSections: Record<DashboardSection, boolean>;
}

const storagePrefix = 'eudiplo.dashboard.preferences.v1';

@Injectable({ providedIn: 'root' })
export class DashboardPreferencesService {
  constructor(
    private readonly apiService: ApiService,
    private readonly jwtService: JwtService
  ) {}

  load(defaults: DashboardPreferences): DashboardPreferences {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return defaults;

      const saved = JSON.parse(raw) as Partial<DashboardPreferences>;
      if (!this.isFocus(saved.focus)) return defaults;

      return {
        focus: saved.focus,
        visibleSections: {
          recentActivity:
            saved.visibleSections?.recentActivity ?? defaults.visibleSections.recentActivity,
          sessionOverview:
            saved.visibleSections?.sessionOverview ?? defaults.visibleSections.sessionOverview,
          quickActions:
            saved.visibleSections?.quickActions ?? defaults.visibleSections.quickActions,
          resources: saved.visibleSections?.resources ?? defaults.visibleSections.resources,
        },
      };
    } catch {
      return defaults;
    }
  }

  save(preferences: DashboardPreferences): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(preferences));
    } catch {
      // The dashboard remains usable when storage is blocked or unavailable.
    }
  }

  reset(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // The in-memory reset still applies when storage is unavailable.
    }
  }

  private get storageKey(): string {
    const payload = this.jwtService.decodeToken(this.apiService.accessToken);
    const tenant = payload?.tenant_id || 'default';
    const user = payload?.sub || payload?.preferred_username || 'anonymous';
    return `${storagePrefix}.${encodeURIComponent(tenant)}.${encodeURIComponent(user)}`;
  }

  private isFocus(value: unknown): value is DashboardFocus {
    return ['balanced', 'issuance', 'verification', 'operations'].includes(String(value));
  }
}
