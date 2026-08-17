# OID4VCI External AS Session Binding

This document describes how EUDIPLO binds externally issued access tokens to the correct OID4VCI issuance session.

## Key distinction

- `issuer_state`: identifies the issuance transaction created by the Credential Offer.
- `sub`: identifies the authenticated subject at the authorization server.
- `credential_identifier`: identifies one authorized credential instance when token authorization details include explicit identifiers.

`issuer_state` and `sub` are not interchangeable.

## External authorization server contract

For issuer-initiated authorization-code offers, configure each external authorization server with an explicit session-binding rule:

```json
{
    "type": "external",
    "id": "keycloak",
    "issuer": "https://auth.example.com/realms/eudiplo",
    "sessionBinding": {
        "method": "access_token_claim",
        "claim": "issuer_state"
    }
}
```

Behavior:

- EUDIPLO resolves the issuance session from the configured access-token claim.
- EUDIPLO rejects the request when the claim is missing or invalid.
- EUDIPLO stores and enforces the selected `authorizationServerIssuer` on the session, so tokens from a different configured AS are rejected.
- EUDIPLO binds the authenticated identity (`iss/sub`) to the session atomically and rejects conflicting rebinding.

## Authorization checks

For credential and deferred retrieval requests, EUDIPLO enforces one of:

- `authorization_details` containing an `openid_credential` entry authorizing the requested `credential_configuration_id`, including matching `credential_identifier` when present.
- Scope-based authorization (when `authorization_details` is absent), using the configured credential scope.

## Chained AS fallback

If an external authorization server cannot return the configured session-binding claim, use EUDIPLO chained authorization-server mode so EUDIPLO can preserve session correlation while delegating user authentication upstream.

## Notes for Keycloak integrations

When Keycloak is used as external AS, add a protocol mapper that copies validated `issuer_state` into the signed access token claim configured in `sessionBinding.claim`.

## Security note

`issuer_state` correlates transaction context; it does not by itself prove entitlement of the authenticated subject to offered claims. Subject-bound claim resolution should normally come from an attribute provider or another trusted subject-binding mechanism.
