---
title: Environment Variables
---

# Environment Variables

EUDIPLO is configured primarily through environment variables. This page documents all available configuration options organized by functional area.

## Quick Reference

The complete environment variable reference is organized into the following sections:

- [Authentication](#authentication) — OAuth client credentials and token validation
- [Configuration](#configuration) — File-based tenant configuration import
- [Cryptography](#cryptography) — Key generation and cryptographic defaults
- [Database](#database) — Database connection and type selection
- [Encryption](#encryption) — At-rest encryption for database-backed keys
- [General](#general) — Public URL, CORS, and operational settings
- [Issuer](#issuer) — Credential issuance flow defaults
- [Logging](#logging) — Log level and structured logging
- [Observability](#observability) — OpenTelemetry tracing configuration
- [Session](#session) — Session cleanup and retention policies
- [Status](#status) — Status list configuration
- [Storage](#storage) — File storage provider (local/S3)
- [Verifier](#verifier) — Presentation verification defaults
- [Webhook](#webhook) — Outbound webhook security policies

## Authentication

import AuthConfig from '@site/docs/generated/config-auth.md';

<AuthConfig />

## Configuration

import ConfigConfig from '@site/docs/generated/config-config.md';

<ConfigConfig />

## Cryptography

import CryptoConfig from '@site/docs/generated/config-crypto.md';

<CryptoConfig />

## Database

import DatabaseConfig from '@site/docs/generated/config-database.md';

<DatabaseConfig />

## Encryption

import EncryptionConfig from '@site/docs/generated/config-encryption.md';

<EncryptionConfig />

## General

import GeneralConfig from '@site/docs/generated/config-general.md';

<GeneralConfig />

## Issuer

import IssuerConfig from '@site/docs/generated/config-issuer.md';

<IssuerConfig />

## Logging

import LogConfig from '@site/docs/generated/config-log.md';

<LogConfig />

## Observability

import ObservabilityConfig from '@site/docs/generated/config-observability.md';

<ObservabilityConfig />

## Session

import SessionConfig from '@site/docs/generated/config-session.md';

<SessionConfig />

## Status

import StatusConfig from '@site/docs/generated/config-status.md';

<StatusConfig />

## Storage

import StorageConfig from '@site/docs/generated/config-storage.md';

<StorageConfig />

## Verifier

import VerifierConfig from '@site/docs/generated/config-verifier.md';

<VerifierConfig />

## Webhook

import WebhookConfig from '@site/docs/generated/config-webhook.md';

<WebhookConfig />

:::info
Key Management System (KMS) and Registrar provider settings are configured via JSON files (`kms.json`, `registrar.json`), not environment variables — see [Key Management System (KMS)](../administration/kms.md) and [Registrar](../trust/registrar.md).
:::
