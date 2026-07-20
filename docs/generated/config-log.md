| Key | Type | Notes |
| --- | ---- | ----- |
| `LOG_LEVEL` | `string` | Application log level  (default: `debug`) |
| `LOG_ENABLE_HTTP_LOGGER` | `boolean` | Enable HTTP request logging  (default: `false`) |
| `LOG_HTTP_RESPONSE_BODY` | `boolean` | Capture and log HTTP response bodies (buffered up to LOG_HTTP_RESPONSE_BODY_MAX_LENGTH bytes). Disabled by default because response bodies may contain access tokens, credentials, or other sensitive data.  (default: `false`) |
| `LOG_HTTP_RESPONSE_BODY_MAX_LENGTH` | `number` | Maximum number of bytes to capture for HTTP response bodies. Set to 0 to disable truncation.  (default: `4096`) |
| `LOG_REDACT_SENSITIVE_DATA` | `boolean` | Redact sensitive request/response fields from logs. Disable only for debugging.  (default: `true`) |
| `LOG_ENABLE_SESSION_LOGGER` | `boolean` | Enable session flow logging  (default: `false`) |
| `LOG_SESSION_STORE` | `string` | Controls whether session log entries are persisted to the database. 'off' disables storage, 'errors' stores only warn/error entries, 'all' stores everything, 'verbose' stores everything including full request/response bodies and error stacks.  (default: `off`) |
| `LOG_TO_FILE` | `boolean` | Enable logging to file in addition to console  (default: `false`) |
| `LOG_FILE_PATH` | `string` | File path for log output when LOG_TO_FILE is enabled  (default: `./logs/session.log`) |
| `AUDIT_LOG_RETENTION_DAYS` | `number` | Delete tenant activity audit log entries older than N days. Set to 0 to disable time-based pruning.  (default: `0`) |
| `OTEL_SDK_DISABLED` | `boolean` | Disable OpenTelemetry SDK (and OTel log forwarding)  (default: `false`) |
| `AUDIT_LOG_MAX_ENTRIES_PER_TENANT` | `number` | Keep only the newest N tenant activity audit log entries per tenant. Set to 0 to disable count-based pruning.  (default: `0`) |
