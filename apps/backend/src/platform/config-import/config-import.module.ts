import { Global, Module } from "@nestjs/common";
import { ConfigImportService } from "./config-import.service";
import { ConfigImportModeService } from "./config-import-mode.service";
import { ConfigImportOrchestratorService } from "./config-import-orchestrator.service";

@Global()
@Module({
    providers: [
        ConfigImportModeService,
        ConfigImportService,
        ConfigImportOrchestratorService,
    ],
    exports: [
        ConfigImportModeService,
        ConfigImportService,
        ConfigImportOrchestratorService,
    ],
})
export class ConfigImportModule {}
