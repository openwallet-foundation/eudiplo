import { Global, Module } from "@nestjs/common";
import { ConfigImportService } from "./config-import.service.js";
import { ConfigImportModeService } from "./config-import-mode.service.js";
import { ConfigImportOrchestratorService } from "./config-import-orchestrator.service.js";

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
