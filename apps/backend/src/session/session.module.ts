import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module.js";
import { TenantEntity } from "../auth/tenant/entities/tenant.entity.js";
import { StatusListModule } from "../issuer/status-list/status-list.module.js";
import { Session } from "./entities/session.entity.js";
import { SessionLogEntry } from "./entities/session-log-entry.entity.js";
import { SessionLoggingModule } from "./logging/session-logging.module.js";
import { SessionController } from "./session.controller.js";
import { SessionService } from "./session.service.js";
import { SessionConfigController } from "./session-config.controller.js";
import { SessionConfigService } from "./session-config.service.js";
import { SessionEventsController } from "./session-events.controller.js";
import { SessionEventsService } from "./session-events.service.js";

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
