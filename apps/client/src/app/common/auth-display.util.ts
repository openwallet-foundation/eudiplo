export function getApiKeyAuthType(auth?: { type?: string }): string {
  return auth?.type === 'apiKey' ? 'API Key' : 'None';
}

export interface AuthFormValue {
  authType: 'apiKey' | 'none';
  authHeaderName: string;
  authHeaderValue: string;
}

export function buildAuthConfig(
  auth: AuthFormValue
): { type: 'apiKey'; config: { headerName: string; value: string } } | { type: 'none' } {
  return auth.authType === 'apiKey'
    ? {
        type: 'apiKey',
        config: {
          headerName: auth.authHeaderName,
          value: auth.authHeaderValue,
        },
      }
    : { type: 'none' };
}

export function toAuthFormValue(auth?: {
  type?: string;
  config?: { headerName?: string; value?: string };
}): AuthFormValue {
  return {
    authType: auth?.type === 'apiKey' ? 'apiKey' : 'none',
    authHeaderName: auth?.type === 'apiKey' ? auth?.config?.headerName || '' : '',
    authHeaderValue: auth?.type === 'apiKey' ? auth?.config?.value || '' : '',
  };
}

export function getApiKeyHeaderName(auth?: {
  type?: string;
  config?: { headerName?: string };
}): string | null {
  if (auth?.type === 'apiKey') {
    return auth.config?.headerName || null;
  }

  return null;
}
