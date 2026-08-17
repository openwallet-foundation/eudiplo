import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigImportService } from "../../platform/config-import/config-import.service";
import { ConfigImportOrchestratorService } from "../../platform/config-import/config-import-orchestrator.service";
import { InternalClientsProvider } from "./adapters/internal-clients.service";
import { KeycloakClientsProvider } from "./adapters/keycloak-clients.service";
import { ClientController } from "./client.controller";
import { CLIENTS_PROVIDER, ClientsProvider } from "./client.provider";
import { ClientEntity } from "./entities/client.entity";

@Module({
    imports: [TypeOrmModule.forFeature([ClientEntity])],
    providers: [
        {
            provide: CLIENTS_PROVIDER,
            inject: [
                ConfigService,
                getRepositoryToken(ClientEntity),
                ConfigImportService,
                ConfigImportOrchestratorService,
            ],
            useFactory: (
                configService: ConfigService,
                repo: Repository<ClientEntity>,
                configImportService: ConfigImportService,
                configImportOrchestrator: ConfigImportOrchestratorService,
            ): ClientsProvider => {
                const useKeycloak = !!configService.get<string>("OIDC"); // if OIDC base/realm is configured, pick KC
                return useKeycloak
                    ? new KeycloakClientsProvider(
                          configService,
                          repo,
                          configImportService,
                          configImportOrchestrator,
                      )
                    : new InternalClientsProvider(
                          configService,
                          repo,
                          configImportService,
                          configImportOrchestrator,
                      );
            },
        },
    ],
    exports: [CLIENTS_PROVIDER],
    controllers: [ClientController],
})
export class ClientModule {}
