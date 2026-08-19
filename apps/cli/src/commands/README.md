# CLI command structure

The CLI uses Commander command factories. Each root command or command group
exports a function named `create…Command` that receives the injectable
`CommandContext` and an exit-code callback.

Every command is a module directory. Its `index.ts` declares the Commander
grammar and its `action.ts` contains the command-specific workflow. Nested
commands follow the same pattern, as with `config/tenant` and
`config/validate`. Put code under `services/` only when it is infrastructure
shared by multiple command modules.

Register new root commands in `runtime.ts`. Do not add manual argument parsing,
root dispatch switches, or separately maintained help text.

The published package README contains the complete extension pattern, examples,
dependency criteria, and verification checklist.
