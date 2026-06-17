import { defineConfig, devices } from '@playwright/test';
import { hasAuthCredentials, resolvedE2EConfig } from './e2e/support/e2e-config';

const baseURL = resolvedE2EConfig.baseURL;
const backendURL = resolvedE2EConfig.backendURL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm run dev',
      cwd: '../backend',
      url: backendURL,
      timeout: 180 * 1000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm exec ng serve --host 127.0.0.1 --port 4200',
      cwd: '.',
      url: baseURL,
      timeout: 180 * 1000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: hasAuthCredentials ? 'playwright/.auth/user.json' : undefined,
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
