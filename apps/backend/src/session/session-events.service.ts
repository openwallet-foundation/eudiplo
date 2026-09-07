import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { filter, map, Observable, Subject } from "rxjs";
import { Session, SessionStatus } from "./entities/session.entity.js";

/**
 * Event payload emitted when a session status changes.
 */
export interface SessionStatusChangedEvent {
    sessionId: string;
    status: SessionStatus;
    updatedAt: Date;
    session?: Session; // Full session data (only included for authenticated requests)
}

/**
 * SSE message format sent to clients.
 */
interface SessionEventMessage {
    id: string;
    status: SessionStatus;
    updatedAt: string;
}

export const SESSION_STATUS_CHANGED = "session.status.changed";

/**
 * Service for managing session events and SSE streams.
 * Provides real-time session status updates via Server-Sent Events.
 */
@Injectable()
export class SessionEventsService {
    private readonly logger = new Logger(SessionEventsService.name);
    private readonly eventSubject = new Subject<SessionStatusChangedEvent>();

    /**
     * Get an observable stream of events for a specific session.
     * Used by the SSE endpoint to stream updates to clients.
     *
     * @param sessionId - The session ID to subscribe to
     * @param includeFullSession - Whether to include full session data (requires auth)
     */
    getSessionEvents(
        sessionId: string,
        _includeFullSession = false,
    ): Observable<MessageEvent> {
        return this.eventSubject.pipe(
            filter((event) => event.sessionId === sessionId),
            map((event) => {
                const data: SessionEventMessage = {
                    id: event.sessionId,
                    status: event.status,
                    updatedAt: event.updatedAt.toISOString(),
                };

                return new MessageEvent("message", {
                    data: JSON.stringify(data),
                });
            }),
        );
    }

    /**
     * Internal event handler for session status changes.
     * Forwards events to the Subject for SSE subscribers.
     */
    @OnEvent(SESSION_STATUS_CHANGED)
    handleSessionStatusChanged(event: SessionStatusChangedEvent): void {
        this.logger.debug(
            `Session ${event.sessionId} status changed to ${event.status}`,
        );
        // Forward to Subject for SSE subscribers
        this.eventSubject.next(event);
    }
}
