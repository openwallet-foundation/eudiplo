# EUDIPLO CLI command reference

Generated from the CLI command definitions. Do not edit this page manually.

```text
Usage: eudiplo [options] [command]

Deployment-aware command line tools for EUDIPLO

Options:
  -v, --version               Print the installed CLI version
  -h, --help                  display help for command

Commands:
  demo [options] [directory]  Start the minimal local demo
  init [options] [directory]  Configure a local deployment
  up [options] [args...]      Start the selected Compose deployment
  down [options] [args...]    Stop the selected Compose deployment
  logs [options] [args...]    Stream logs for the selected Compose deployment
  instance                    Manage configured EUDIPLO instances
  config                      Validate and manage local configuration
  doctor [options]            Run deployment diagnostics
  status [options]            Print the selected instance status
  version                     Print the installed version and check for updates
  completion <shell>          Generate shell completion scripts
  commands [options]          List every available CLI command
  help [command]              display help for command
```

## `eudiplo demo`

Start the minimal local demo

```text
Usage: eudiplo demo [options] [directory]

Start the minimal local demo

Arguments:
  directory           project directory

Options:
  --directory <path>  set the project directory
  --reset             recreate managed demo data and configuration
  --force             allow replacement of managed demo files
  --yes               accept the default directory without prompting
  --no-interactive    disable the directory prompt
  --image-tag <tag>   override the backend and client image tag
  -h, --help          display help for command
```

## `eudiplo init`

Configure a local deployment

```text
Usage: eudiplo init [options] [directory]

Configure a local deployment

Arguments:
  directory                         project directory

Options:
  --directory <path>                set the project directory
  --target <compose|external>       deployment target
  --instance <name>                 instance name (default: "local")
  --preset <minimal|standard|full>  deployment preset
  --database <sqlite|postgres>      database
  --storage <local|s3>              storage
  --kms <db|vault>                  key management
  --public-url <url>                public EUDIPLO URL
  --auth-client-id <id>             authentication client ID
  --auth-client-secret <secret>     authentication client secret
  --demo-tenant                     include the bundled demo tenant
  --no-demo-tenant                  do not include the bundled demo tenant
  --client                          include the web client
  --no-client                       omit the web client
  --no-interactive                  disable the setup wizard
  --start                           start the deployment after initialization
  --yes                             accept defaults without opening the wizard
  --image-tag <tag>                 override the backend and client image tag
  --demo                            generate demo-compatible assets without
                                    starting them
  --force                           replace CLI-managed files
  --url <url>                       override the instance API URL
  -h, --help                        display help for command
```

## `eudiplo up`

Start the selected Compose deployment

```text
Usage: eudiplo up [options] [args...]

Start the selected Compose deployment

Arguments:
  args               additional arguments passed to the Compose runtime

Options:
  --instance <name>  select a configured Compose instance
  -h, --help         display help for command
```

## `eudiplo down`

Stop the selected Compose deployment

```text
Usage: eudiplo down [options] [args...]

Stop the selected Compose deployment

Arguments:
  args               additional arguments passed to the Compose runtime

Options:
  --instance <name>  select a configured Compose instance
  -h, --help         display help for command
```

## `eudiplo logs`

Stream logs for the selected Compose deployment

```text
Usage: eudiplo logs [options] [args...]

Stream logs for the selected Compose deployment

Arguments:
  args               additional arguments passed to the Compose runtime

Options:
  --instance <name>  select a configured Compose instance
  -h, --help         display help for command
```

## `eudiplo instance`

Manage configured EUDIPLO instances

```text
Usage: eudiplo instance [options] [command]

Manage configured EUDIPLO instances

Options:
  -h, --help            display help for command

Commands:
  list|ls               List configured EUDIPLO instances
  show [name]           Show configured instance details
  use <name>            Set the default EUDIPLO instance
  remove|rm <name>      Unregister an EUDIPLO instance
  add [options] <name>  Register an existing EUDIPLO deployment
  help [command]        display help for command
```

## `eudiplo instance list`

List configured EUDIPLO instances

```text
Usage: eudiplo instance list|ls [options]

List configured EUDIPLO instances

Options:
  -h, --help  display help for command
```

## `eudiplo instance show`

Show configured instance details

```text
Usage: eudiplo instance show [options] [name]

Show configured instance details

Options:
  -h, --help  display help for command
```

## `eudiplo instance use`

Set the default EUDIPLO instance

```text
Usage: eudiplo instance use [options] <name>

Set the default EUDIPLO instance

Options:
  -h, --help  display help for command
```

## `eudiplo instance remove`

Unregister an EUDIPLO instance

```text
Usage: eudiplo instance remove|rm [options] <name>

Unregister an EUDIPLO instance

Options:
  -h, --help  display help for command
```

## `eudiplo instance add`

Register an existing EUDIPLO deployment

```text
Usage: eudiplo instance add [options] <name>

Register an existing EUDIPLO deployment

Options:
  --url <url>                  EUDIPLO API URL
  --target <compose|external>  deployment target (default: "external")
  --client-url <url>           optional web client URL
  -h, --help                   display help for command
```

## `eudiplo config`

Validate and manage local configuration

```text
Usage: eudiplo config [options] [command]

Validate and manage local configuration

Options:
  -h, --help                         display help for command

Commands:
  path                               Print the active CLI config file path
  show [options]                     Show the validated CLI configuration
  validate [options] [scope] [path]  Validate CLI or tenant config-import files
  editor                             Configure editor support for local
                                     configuration files
  tenant                             Manage local tenant configuration folders
  export [options]                   Export a tenant configuration bundle
  plan [options] <bundle>            Plan a tenant configuration bundle
  import [options] <bundle>          Apply a tenant configuration bundle
  upgrade [options] <file>           Upgrade a local configuration document or
                                     bundle
  help [command]                     display help for command
```

## `eudiplo config path`

Print the active CLI config file path

```text
Usage: eudiplo config path [options]

Print the active CLI config file path

Options:
  -h, --help  display help for command
```

## `eudiplo config show`

Show the validated CLI configuration

```text
Usage: eudiplo config show [options]

Show the validated CLI configuration

Options:
  --json      print config as JSON
  -h, --help  display help for command
```

## `eudiplo config validate`

Validate CLI or tenant config-import files

```text
Usage: eudiplo config validate [options] [scope] [path]

Validate CLI or tenant config-import files

Options:
  --format <text|json>  tenant report format (choices: "text", "json", default:
                        "text")
  -h, --help            display help for command
```

## `eudiplo config editor`

Configure editor support for local configuration files

```text
Usage: eudiplo config editor [options] [command]

Configure editor support for local configuration files

Options:
  -h, --help                   display help for command

Commands:
  setup [options] [workspace]  Install bundled JSON Schemas and configure VS
                               Code
  help [command]               display help for command
```

## `eudiplo config editor setup`

Install bundled JSON Schemas and configure VS Code

```text
Usage: eudiplo config editor setup [options] [workspace]

Install bundled JSON Schemas and configure VS Code

Options:
  --config-directory <path>  tenant config root relative to the workspace
                             (default: "config")
  -h, --help                 display help for command
```

## `eudiplo config tenant`

Manage local tenant configuration folders

```text
Usage: eudiplo config tenant [options] [command]

Manage local tenant configuration folders

Options:
  -h, --help                        display help for command

Commands:
  list|ls [options]                 List local tenant configurations
  create|new [options] <tenant-id>  Create a local tenant configuration
  validate [options] [tenant-id]    Validate one or all local tenant
                                    configurations
  remove|rm [options] <tenant-id>   Remove a local tenant configuration folder
  help [command]                    display help for command
```

## `eudiplo config tenant list`

List local tenant configurations

```text
Usage: eudiplo config tenant list|ls [options]

List local tenant configurations

Options:
  --instance <name>          select a configured Compose instance
  --config-directory <path>  use an explicit config root
  -h, --help                 display help for command
```

## `eudiplo config tenant create`

Create a local tenant configuration

```text
Usage: eudiplo config tenant create|new [options] <tenant-id>

Create a local tenant configuration

Options:
  --instance <name>          select a configured Compose instance
  --config-directory <path>  use an explicit config root
  --name <name>              tenant display name
  --description <text>       optional tenant description
  --template <empty|demo>    tenant template (choices: "empty", "demo", default:
                             "empty")
  -h, --help                 display help for command
```

## `eudiplo config tenant validate`

Validate one or all local tenant configurations

```text
Usage: eudiplo config tenant validate [options] [tenant-id]

Validate one or all local tenant configurations

Options:
  --instance <name>          select a configured Compose instance
  --config-directory <path>  use an explicit config root
  --format <text|json>       tenant report format (choices: "text", "json",
                             default: "text")
  -h, --help                 display help for command
```

## `eudiplo config tenant remove`

Remove a local tenant configuration folder

```text
Usage: eudiplo config tenant remove|rm [options] <tenant-id>

Remove a local tenant configuration folder

Options:
  --instance <name>          select a configured Compose instance
  --config-directory <path>  use an explicit config root
  --force                    confirm removal without prompting
  -h, --help                 display help for command
```

## `eudiplo config export`

Export a tenant configuration bundle

```text
Usage: eudiplo config export [options]

Export a tenant configuration bundle

Options:
  --instance <name>  select a configured instance
  --token <token>    management API access token
  --output <path>    output bundle path
  -h, --help         display help for command
```

## `eudiplo config plan`

Plan a tenant configuration bundle

```text
Usage: eudiplo config plan [options] <bundle>

Plan a tenant configuration bundle

Options:
  --instance <name>  select a configured instance
  --token <token>    management API access token
  --mode <mode>      import mode (choices: "create", "upsert", "replace",
                     default: "upsert")
  -h, --help         display help for command
```

## `eudiplo config import`

Apply a tenant configuration bundle

```text
Usage: eudiplo config import [options] <bundle>

Apply a tenant configuration bundle

Options:
  --instance <name>  select a configured instance
  --token <token>    management API access token
  --mode <mode>      import mode (choices: "create", "upsert", "replace",
                     default: "upsert")
  --confirm-replace  confirm deletion semantics for replace mode
  -h, --help         display help for command
```

## `eudiplo config upgrade`

Upgrade a local configuration document or bundle

```text
Usage: eudiplo config upgrade [options] <file>

Upgrade a local configuration document or bundle

Options:
  --output <path>  write upgraded JSON to this path
  --dry-run        report migrations without writing output
  -h, --help       display help for command
```

## `eudiplo doctor`

Run deployment diagnostics

```text
Usage: eudiplo doctor [options]

Run deployment diagnostics

Options:
  --instance <name>  select a configured instance
  -h, --help         display help for command
```

## `eudiplo status`

Print the selected instance status

```text
Usage: eudiplo status [options]

Print the selected instance status

Options:
  --instance <name>  select a configured instance
  -h, --help         display help for command
```

## `eudiplo version`

Print the installed version and check for updates

```text
Usage: eudiplo version [options]

Print the installed version and check for updates

Options:
  -h, --help  display help for command
```

## `eudiplo completion`

Generate shell completion scripts

```text
Usage: eudiplo completion [options] <shell>

Generate shell completion scripts

Arguments:
  shell       shell to generate completion for (choices: "bash", "zsh", "fish",
              "powershell")

Options:
  -h, --help  display help for command
```

## `eudiplo commands`

List every available CLI command

```text
Usage: eudiplo commands [options]

List every available CLI command

Options:
  --format <text|markdown>  output format (choices: "text", "markdown", default:
                            "text")
  -h, --help                display help for command
```
