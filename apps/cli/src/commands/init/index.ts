import { Command, Option } from "commander";
import type { CommandContext } from "../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../shared.js";
import { runInit } from "./action.js";

export function createInitCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    return new Command("init")
        .description("Configure a local deployment")
        .argument("[directory]", "project directory")
        .option("--directory <path>", "set the project directory")
        .option("--target <compose|external>", "deployment target")
        .option("--instance <name>", "instance name", "local")
        .option("--preset <minimal|standard|full>", "deployment preset")
        .option("--database <sqlite|postgres>", "database")
        .option("--storage <local|s3>", "storage")
        .option("--kms <db|vault>", "key management")
        .option("--public-url <url>", "public EUDIPLO URL")
        .option("--auth-client-id <id>", "authentication client ID")
        .option("--auth-client-secret <secret>", "authentication client secret")
        .option("--demo-tenant", "include the bundled demo tenant")
        .option("--no-demo-tenant", "do not include the bundled demo tenant")
        .option("--client", "include the web client")
        .option("--no-client", "omit the web client")
        .addOption(new Option("--interactive").hideHelp())
        .option("--no-interactive", "disable the setup wizard")
        .option("--start", "start the deployment after initialization")
        .option("--yes", "accept defaults without opening the wizard")
        .option(
            "--image-tag <tag>",
            "override the backend and client image tag",
        )
        .option(
            "--demo",
            "generate demo-compatible assets without starting them",
        )
        .option("--force", "replace CLI-managed files")
        .option("--url <url>", "override the instance API URL")
        .action(async (directory, options) => {
            const { configPath, config } = await loadCliState(context);
            setExitCode(
                await runInit(
                    configPath,
                    config,
                    parsedArgs("init", directory, [], options),
                    context,
                ),
            );
        });
}
