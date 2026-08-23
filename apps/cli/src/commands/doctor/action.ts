import { drivers } from "../../services/deployment-drivers.js";
import {
    formatChecks,
    hasFailedChecks,
    runDoctor,
} from "../../services/diagnostics.js";
import { resolveInstance } from "../../services/instance-selection.js";
import type { CliConfig, CommandContext, ParsedArgs } from "../../types.js";

export async function runDoctorCommand(
    config: CliConfig,
    parsed: ParsedArgs,
    context: CommandContext,
): Promise<number> {
    const [instanceName, instance] = resolveInstance(config, parsed);
    const driver = drivers[instance.target];
    const checks = await runDoctor(
        instance,
        context,
        await driver.diagnostics(instance, context),
    );
    context.stdout.write(`Doctor for ${instanceName} (${instance.target})\n`);
    context.stdout.write(`${formatChecks(checks)}\n`);
    return hasFailedChecks(checks) ? 1 : 0;
}
