import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'eudiplo-theme';
  readonly themeChanges = new Subject<boolean>();
  isDarkMode = false;
  private readonly systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private hasUserPreference = false;

  constructor() {
    const storedTheme = localStorage.getItem(this.storageKey);
    this.hasUserPreference = storedTheme === 'dark' || storedTheme === 'light';
    this.isDarkMode = this.hasUserPreference
      ? storedTheme === 'dark'
      : this.systemThemeQuery.matches;
    this.systemThemeQuery.addEventListener('change', this.handleSystemThemeChange);
    this.applyTheme();
  }

  toggle(): void {
    this.isDarkMode = !this.isDarkMode;
    this.hasUserPreference = true;
    localStorage.setItem(this.storageKey, this.isDarkMode ? 'dark' : 'light');
    this.themeChanges.next(this.isDarkMode);
    this.applyTheme();
  }

  destroy(): void {
    this.systemThemeQuery.removeEventListener('change', this.handleSystemThemeChange);
    this.themeChanges.complete();
  }

  private readonly handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    if (this.hasUserPreference) {
      return;
    }

    this.isDarkMode = event.matches;
    this.themeChanges.next(this.isDarkMode);
    this.applyTheme();
  };

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
  }
}
