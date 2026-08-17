import { Global, Module } from "@nestjs/common";
import { ConfigImportService } from "./config-import.service";
import { ConfigImportOrchestratorService } from "./config-import-orchestrator.service";

@Global()
@Module({
    providers: [ConfigImportService, ConfigImportOrchestratorService],
    exports: [ConfigImportService, ConfigImportOrchestratorService],
})
export class ConfigImportModule {}
