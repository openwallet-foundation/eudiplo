import { Command, Option } from "commander";
import type { CommandContext } from "../../../types.js";
import { loadCliState, parsedArgs, type SetExitCode } from "../../shared.js";
import { tenantCommand } from "./action.js";

export function createTenantCommand(
    context: CommandContext,
    setExitCode: SetExitCode,
): Command {
    const tenant = new Command("tenant")
        .description("Manage local tenant configuration folders")
        .helpCommand(true);

    tenant
        .command("list")
        .alias("ls")
        .description("List local tenant configurations")
        .option("--instance <name>", "select a configured Compose instance")
        .option("--config-directory <path>", "use an explicit config root")
        .action(async (options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await tenantCommand(
                    config,
                    parsedArgs("config", "list", [], options),
                    context,
                ),
            );
        });

    tenant
        .command("create <tenant-id>")
        .alias("new")
        .description("Create a local tenant configuration")
        .option("--instance <name>", "select a configured Compose instance")
        .option("--config-directory <path>", "use an explicit config root")
        .option("--name <name>", "tenant display name")
        .option("--description <text>", "optional tenant description")
        .addOption(
            new Option("--template <empty|demo>", "tenant template")
                .choices(["empty", "demo"])
                .default("empty"),
        )
        .action(async (tenantId, options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await tenantCommand(
                    config,
                    parsedArgs("config", "create", [tenantId], options),
                    context,
                ),
            );
        });

    tenant
        .command("validate [tenant-id]")
        .description("Validate one or all local tenant configurations")
        .option("--instance <name>", "select a configured Compose instance")
        .option("--config-directory <path>", "use an explicit config root")
        .addOption(
            new Option("--format <text|json>", "tenant report format")
                .choices(["text", "json"])
                .default("text"),
        )
        .action(async (tenantId, options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await tenantCommand(
                    config,
                    parsedArgs(
                        "config",
                        "validate",
                        tenantId ? [tenantId] : [],
                        options,
                    ),
                    context,
                ),
            );
        });

    tenant
        .command("remove <tenant-id>")
        .aliases(["rm", "delete"])
        .description("Remove a local tenant configuration folder")
        .option("--instance <name>", "select a configured Compose instance")
        .option("--config-directory <path>", "use an explicit config root")
        .option("--force", "confirm removal without prompting")
        .action(async (tenantId, options) => {
            const { config } = await loadCliState(context);
            setExitCode(
                await tenantCommand(
                    config,
                    parsedArgs("config", "remove", [tenantId], options),
                    context,
                ),
            );
        });

    tenant.action(function showTenantHelp() {
        this.outputHelp();
    });
    return tenant;
}
