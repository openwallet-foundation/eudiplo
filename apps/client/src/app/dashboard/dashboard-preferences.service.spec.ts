import { ApiService } from '../core';
import { JwtService, type JWTPayload } from '../services/jwt.service';
import { DashboardPreferences, DashboardPreferencesService } from './dashboard-preferences.service';

describe('DashboardPreferencesService', () => {
  const defaults: DashboardPreferences = {
    focus: 'balanced',
    visibleSections: {
      recentActivity: true,
      sessionOverview: true,
      quickActions: true,
      resources: true,
    },
  };

  let payload: JWTPayload;
  let service: DashboardPreferencesService;

  beforeEach(() => {
    const entries = new Map<string, string>();
    const storage = {
      get length() {
        return entries.size;
      },
      clear: () => entries.clear(),
      getItem: (key: string) => entries.get(key) ?? null,
      key: (index: number) => [...entries.keys()][index] ?? null,
      removeItem: (key: string) => entries.delete(key),
      setItem: (key: string, value: string) => entries.set(key, value),
    } as Storage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    localStorage.clear();
    payload = { sub: 'user-a', tenant_id: 'tenant-a', roles: [] };
    const apiService = { accessToken: 'token' } as ApiService;
    const jwtService = { decodeToken: () => payload } as unknown as JwtService;
    service = new DashboardPreferencesService(apiService, jwtService);
  });

  it('returns role-based defaults when no preferences are saved', () => {
    expect(service.load(defaults)).toEqual(defaults);
  });

  it('persists dashboard preferences for the current user', () => {
    const preferences: DashboardPreferences = {
      focus: 'operations',
      visibleSections: {
        recentActivity: true,
        sessionOverview: true,
        quickActions: false,
        resources: false,
      },
    };

    service.save(preferences);

    expect(service.load(defaults)).toEqual(preferences);
  });

  it('keeps preferences separate between users', () => {
    service.save({
      ...defaults,
      visibleSections: { ...defaults.visibleSections, resources: false },
    });
    payload = { sub: 'user-b', tenant_id: 'tenant-a', roles: [] };

    expect(service.load(defaults)).toEqual(defaults);
  });

  it('falls back safely when stored preferences are malformed', () => {
    localStorage.setItem('eudiplo.dashboard.preferences.v1.tenant-a.user-a', '{broken');

    expect(service.load(defaults)).toEqual(defaults);
  });
});
