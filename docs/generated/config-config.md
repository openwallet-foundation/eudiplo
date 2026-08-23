| Key | Type | Notes |
| --- | ---- | ----- |
| `CONFIG_IMPORT_MODE` | `string` | Startup configuration reconciliation mode. Replaces CONFIG_IMPORT and CONFIG_IMPORT_FORCE. |
| `CONFIG_IMPORT` | `boolean` | Deprecated: enable startup config import when CONFIG_IMPORT_MODE is unset  (default: `false`) |
| `CONFIG_IMPORT_FORCE` | `boolean` | Deprecated: select upsert instead of create when CONFIG_IMPORT_MODE is unset  (default: `false`) |
| `CONFIG_FOLDER` | `string` | Path to config import folder  (default: `/path/to/config/folder`) |
| `CONFIG_VARIABLE_STRICT` | `alternatives` | Strict mode for config import.  (default: `skip`) |
