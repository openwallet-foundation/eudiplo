| Key | Type | Notes |
| --- | ---- | ----- |
| `LOG_LEVEL` | `string` | Application log level  (default: `debug`) |
| `LOG_ENABLE_HTTP_LOGGER` | `boolean` | Enable HTTP request logging  (default: `false`) |
| `LOG_ENABLE_SESSION_LOGGER` | `boolean` | Enable session flow logging  (default: `false`) |
| `LOG_SESSION_STORE` | `string` | Controls whether session log entries are persisted to the database. 'off' disables storage, 'errors' stores only warn/error entries, 'all' stores everything, 'verbose' stores everything including full request/response bodies and error stacks.  (default: `off`) |
| `LOG_TO_FILE` | `boolean` | Enable logging to file in addition to console  (default: `false`) |
| `LOG_FILE_PATH` | `string` | File path for log output when LOG_TO_FILE is enabled  (default: `./logs/session.log`) |
| `AUDIT_LOG_RETENTION_DAYS` | `number` | Delete tenant activity audit log entries older than N days. Set to 0 to disable time-based pruning.  (default: `0`) |
| `AUDIT_LOG_MAX_ENTRIES_PER_TENANT` | `number` | Keep only the newest N tenant activity audit log entries per tenant. Set to 0 to disable count-based pruning.  (default: `0`) |
