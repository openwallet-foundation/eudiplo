import { Global, Module } from "@nestjs/common";
import { ConfigMigrationService } from "./config-migration.service.js";
import { ConfigResourceRegistry } from "./config-resource.registry.js";

@Global()
@Module({
    providers: [ConfigResourceRegistry, ConfigMigrationService],
    exports: [ConfigResourceRegistry, ConfigMigrationService],
})
export class ConfigResourceCoreModule {}
