// Main client export
export { EudiploClient } from './client';
export type {
  EudiploClientConfig,
  SessionPollingOptions,
  SessionStatusEvent,
  SessionSubscriptionOptions,
  SessionSubscription,
} from './client';

export type {
  EudiploCredentials,
  IssuanceOfferOptions,
  PresentationRequestOptions,
  OfferResult,
} from './client';

// Digital Credentials API exports
export {
  isDcApiAvailable,
} from './client';
export type {
  DcApiPresentationOptions,
  DcApiPresentationResult,
  DigitalCredentialResponse,
} from './client';

// Re-export the HTTP client instance for direct API usage
export { client } from './api/client.gen';

// Re-export API types for advanced usage
export * from './api';

// Credential config v2 helpers
export * from './config';