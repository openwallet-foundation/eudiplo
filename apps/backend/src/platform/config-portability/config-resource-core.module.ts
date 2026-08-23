import { Global, Module } from "@nestjs/common";
import { ConfigMigrationService } from "./config-migration.service";
import { ConfigResourceRegistry } from "./config-resource.registry";

@Global()
@Module({
    providers: [ConfigResourceRegistry, ConfigMigrationService],
    exports: [ConfigResourceRegistry, ConfigMigrationService],
})
export class ConfigResourceCoreModule {}
