import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { TenantEntity } from "../auth/tenant/entities/tenant.entity";
import { StatusListModule } from "../issuer/status-list/status-list.module";
import { Session } from "./entities/session.entity";
import { SessionLogEntry } from "./entities/session-log-entry.entity";
import { SessionLoggingModule } from "./logging/session-logging.module";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { SessionConfigController } from "./session-config.controller";
import { SessionConfigService } from "./session-config.service";
import { SessionEventsController } from "./session-events.controller";
import { SessionEventsService } from "./session-events.service";

/**
 * SessionModule is responsible for managing user sessions.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Session, TenantEntity, SessionLogEntry]),
        StatusListModule,
        SessionLoggingModule,
        AuthModule,
    ],
    providers: [SessionService, SessionConfigService, SessionEventsService],
    exports: [
        SessionService,
        SessionConfigService,
        SessionEventsService,
        SessionLoggingModule,
    ],
    controllers: [
        SessionController,
        SessionConfigController,
        SessionEventsController,
    ],
})
export class SessionModule {}
