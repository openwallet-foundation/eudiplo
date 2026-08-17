import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SessionLogEntry } from "../entities/session-log-entry.entity";
import { SessionAuditService } from "./session-audit.service";
import { SessionLogStoreService } from "./session-log-store.service";
import { SessionLoggerService } from "./session-logger.service";

/**
 * Owns session-scoped protocol logging.
 *
 * Provides two services:
 * - `SessionAuditService`: persists audit events to the database only.
 * - `SessionLoggerService`: persists to the database AND logs via PinoLogger
 *   (exported to Loki via OpenTelemetry) for full observability.
 */
@Module({
    imports: [TypeOrmModule.forFeature([SessionLogEntry])],
    providers: [
        SessionLogStoreService,
        SessionAuditService,
        SessionLoggerService,
    ],
    exports: [
        SessionAuditService,
        SessionLoggerService,
        SessionLogStoreService,
    ],
})
export class SessionLoggingModule {}
