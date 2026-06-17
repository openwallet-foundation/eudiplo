import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type DotenvMap = Record<string, string>;

function parseDotEnv(content: string): DotenvMap {
  const result: DotenvMap = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

function loadBackendEnv(): DotenvMap {
  const candidates = [
    resolve(process.cwd(), '../backend/.env'),
    resolve(process.cwd(), 'apps/backend/.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    return parseDotEnv(readFileSync(envPath, 'utf-8'));
  }

  return {};
}

const backendEnv = loadBackendEnv();
const allowRootFallback = process.env['E2E_ALLOW_ROOT_FALLBACK'] === 'true';

const resolvedClientId =
  process.env['E2E_TENANT_CLIENT_ID'] ??
  process.env['E2E_CLIENT_ID'] ??
  backendEnv['E2E_TENANT_CLIENT_ID'] ??
  backendEnv['E2E_CLIENT_ID'] ??
  (allowRootFallback ? backendEnv['AUTH_CLIENT_ID'] : undefined);

const resolvedClientSecret =
  process.env['E2E_TENANT_CLIENT_SECRET'] ??
  process.env['E2E_CLIENT_SECRET'] ??
  backendEnv['E2E_TENANT_CLIENT_SECRET'] ??
  backendEnv['E2E_CLIENT_SECRET'] ??
  (allowRootFallback ? backendEnv['AUTH_CLIENT_SECRET'] : undefined);

export const resolvedE2EConfig = {
  apiBaseUrl: process.env['PLAYWRIGHT_API_URL'] ?? 'http://127.0.0.1:3000',
  clientId: resolvedClientId,
  clientSecret: resolvedClientSecret,
  baseURL: process.env['PLAYWRIGHT_TEST_BASE_URL'] ?? 'http://127.0.0.1:4200',
  backendURL: process.env['PLAYWRIGHT_BACKEND_URL'] ?? 'http://127.0.0.1:3000/api/docs-json',
};

export const hasAuthCredentials = Boolean(
  resolvedE2EConfig.clientId && resolvedE2EConfig.clientSecret,
);
