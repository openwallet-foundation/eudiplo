import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    SessionLogEntry,
    SessionLogLevel,
} from "../entities/session-log-entry.entity";

export type SessionStoreMode = "off" | "errors" | "all" | "verbose";

@Injectable()
export class SessionLogStoreService {
    private readonly mode: SessionStoreMode;

    constructor(
        @InjectRepository(SessionLogEntry)
        private readonly logRepository: Repository<SessionLogEntry>,
        private readonly configService: ConfigService,
    ) {
        this.mode =
            this.configService.getOrThrow<SessionStoreMode>(
                "LOG_SESSION_STORE",
            );
    }

    /**
     * Append a log entry to the database if the store mode allows it.
     */
    async append(
        sessionId: string,
        level: SessionLogLevel,
        message: string,
        stage?: string,
        detail?: Record<string, unknown>,
    ): Promise<void> {
        if (!sessionId) return;
        if (this.mode === "off") return;
        if (this.mode === "errors" && level === "info") return;
        // "all" and "verbose" store everything; verbose callers pass richer detail

        await this.logRepository.save({
            sessionId,
            level,
            message,
            stage,
            detail,
        });
    }

    /**
     * Retrieve all log entries for a session, ordered by timestamp.
     */
    findBySessionId(sessionId: string): Promise<SessionLogEntry[]> {
        return this.logRepository.find({
            where: { sessionId },
            order: { timestamp: "ASC" },
        });
    }

    /**
     * Delete all log entries for a session.
     */
    deleteBySessionId(sessionId: string): Promise<void> {
        return this.logRepository.delete({ sessionId }).then(() => undefined);
    }
}
