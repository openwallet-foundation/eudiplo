import { ThemeService } from './theme.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ThemeService', () => {
  let systemThemeListener: ((event: MediaQueryListEvent) => void) | undefined;
  let systemThemeQuery: MediaQueryList;

  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    localStorage.clear();
    document.documentElement.className = '';
    systemThemeQuery = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        systemThemeListener = listener as (event: MediaQueryListEvent) => void;
      },
      removeEventListener: () => {
        systemThemeListener = undefined;
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => systemThemeQuery,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the system preference when no saved preference exists', () => {
    systemThemeQuery = { ...systemThemeQuery, matches: true } as MediaQueryList;

    const service = new ThemeService();

    expect(service.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    service.destroy();
  });

  it('persists an explicit user preference', () => {
    const service = new ThemeService();

    service.toggle();

    expect(service.isDarkMode).toBe(true);
    expect(localStorage.getItem('eudiplo-theme')).toBe('dark');
    service.destroy();
  });

  it('follows system changes until the user chooses a mode', () => {
    const service = new ThemeService();
    const changes: boolean[] = [];
    service.themeChanges.subscribe((isDark) => changes.push(isDark));

    systemThemeListener?.({ matches: true } as MediaQueryListEvent);

    expect(service.isDarkMode).toBe(true);
    expect(changes).toEqual([true]);
    service.destroy();
  });

  it('ignores system changes after the user chooses a mode', () => {
    const service = new ThemeService();
    service.toggle();

    systemThemeListener?.({ matches: false } as MediaQueryListEvent);

    expect(service.isDarkMode).toBe(true);
    service.destroy();
  });
});
