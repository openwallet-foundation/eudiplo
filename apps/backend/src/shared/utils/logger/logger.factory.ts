import { ConfigService } from "@nestjs/config";
import { IncomingMessage } from "node:http";
import { Params } from "nestjs-pino";
import { SerializedRequest, SerializedResponse } from "pino";

const MAX_LOGGED_RESPONSE_BODY_LENGTH = 4096;

const SENSITIVE_KEY_PATTERN =
    /password|secret|token|authorization|cookie|set-cookie|clientsecret|access_token|refresh_token/i;

function redactSensitiveValues(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveValues(item));
    }

    if (value && typeof value === "object") {
        const redacted: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(
            value as Record<string, unknown>,
        )) {
            redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
                ? "[REDACTED]"
                : redactSensitiveValues(nestedValue);
        }
        return redacted;
    }

    return value;
}

function truncate(value: string): string {
    if (value.length <= MAX_LOGGED_RESPONSE_BODY_LENGTH) {
        return value;
    }

    return `${value.slice(0, MAX_LOGGED_RESPONSE_BODY_LENGTH)}...[truncated]`;
}

function serializeResponseBody(
    rawBody: Buffer,
    contentType: string | undefined,
): unknown {
    if (!rawBody.length) {
        return undefined;
    }

    const normalizedContentType = (contentType || "").toLowerCase();
    const isLikelyText =
        normalizedContentType.includes("json") ||
        normalizedContentType.startsWith("text/") ||
        normalizedContentType.includes("xml") ||
        normalizedContentType.includes("javascript") ||
        normalizedContentType.includes("x-www-form-urlencoded") ||
        normalizedContentType === "";

    if (!isLikelyText) {
        return "[non-text response omitted]";
    }

    const bodyText = truncate(rawBody.toString("utf8"));

    if (normalizedContentType.includes("json")) {
        try {
            return redactSensitiveValues(JSON.parse(bodyText));
        } catch {
            return bodyText;
        }
    }

    return bodyText;
}

function attachResponseBodyCapture(req: any, res: any): void {
    const response = res?.raw ?? res;
    if (!response || response.__eudiploResponseBodyCaptureInstalled) {
        return;
    }

    response.__eudiploResponseBodyCaptureInstalled = true;

    const chunks: Buffer[] = [];
    const originalWrite = response.write?.bind(response);
    const originalEnd = response.end?.bind(response);

    if (typeof originalWrite !== "function" || typeof originalEnd !== "function") {
        return;
    }

    response.write = (chunk: unknown, ...args: unknown[]) => {
        if (chunk !== undefined && chunk !== null) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return originalWrite(chunk, ...args);
    };

    response.end = (chunk?: unknown, ...args: unknown[]) => {
        if (chunk !== undefined && chunk !== null) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }

        const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
        const responseContentType =
            typeof response.getHeader === "function"
                ? String(response.getHeader("content-type") || "")
                : undefined;

        response.__eudiploLoggedResponseBody = serializeResponseBody(
            bodyBuffer,
            responseContentType,
        );

        return originalEnd(chunk, ...args);
    };
}

/**
 * Factory function for configuring the logger module
 *
 * Logging targets:
 * - Console: pino-pretty for human-readable output
 * - File: JSON logs (optional, via LOG_TO_FILE)
 * - OpenTelemetry: pino-opentelemetry-transport sends logs to OTel Collector
 *
 * Trace correlation:
 * - @opentelemetry/instrumentation-pino automatically injects trace_id/span_id
 * - pino-opentelemetry-transport forwards context to OTel logs pipeline
 *
 * @param configService The config service instance
 * @returns The logger configuration object
 */
export const createLoggerOptions = (configService: ConfigService) => {
    // Disable pino-http's autoLogging - we handle HTTP logging explicitly
    const enableHttpLogger = configService.getOrThrow<boolean>(
        "LOG_ENABLE_HTTP_LOGGER",
    );

    // Check if file logging is enabled
    const logToFile = configService.getOrThrow<boolean>("LOG_TO_FILE");
    const logFilePath = configService.getOrThrow<string>("LOG_FILE_PATH");

    // Check if OTel is disabled
    const otelDisabled = configService.getOrThrow<boolean>("OTEL_SDK_DISABLED");
    const logLevel = configService.getOrThrow("LOG_LEVEL");

    // Build transport targets array
    const targets: any[] = [
        // Console pretty logging (always enabled)
        {
            target: "pino-pretty",
            level: logLevel,
            options: {
                colorize: true,
                singleLine: false,
                translateTime: "yyyy-mm-dd HH:MM:ss",
                //ignore: "pid,hostname,req,res,responseTime,context",
                messageFormat: "{if context}[{context}] {end}{msg}",
            },
        },
    ];

    // Optional: File logging
    if (logToFile && logFilePath) {
        targets.push({
            target: "pino/file",
            level: logLevel,
            options: {
                destination: logFilePath,
                mkdir: true,
                sync: true, // Use synchronous writes to ensure message order
            },
        });
    }

    // Optional: OpenTelemetry transport (sends logs to OTel Collector → Loki)
    // This is how pino logs get trace correlation and appear in Grafana/Loki
    if (!otelDisabled) {
        targets.push({
            target: "pino-opentelemetry-transport",
            level: logLevel,
            options: {
                // Resource attributes must be explicitly passed to the transport
                // (it doesn't inherit from the OTel SDK automatically)
                resourceAttributes: {
                    "service.name":
                        configService.get("OTEL_SERVICE_NAME") ||
                        "eudiplo-backend",
                    "service.version":
                        configService.get("VERSION") || "unknown",
                },
            },
        });
    }

    return {
        pinoHttp: {
            level: logLevel,
            autoLogging: {
                ignore: (req: IncomingMessage) => {
                    if (!enableHttpLogger) {
                        return true;
                    }
                    //check if path includes /api to ignore it
                    if (req.url?.includes("/api")) {
                        return true;
                    }
                    return false;
                },
            },
            transport: {
                targets,
            },
            formatters: {
                log: (object: any) => {
                    object.hostname = undefined;
                    return object;
                },
            },
            customProps: (req: any, res: any) => {
                attachResponseBodyCapture(req, res);
                return {
                    sessionId: req.params?.session,
                };
            },
            serializers: {
                req: (req: SerializedRequest) => ({
                    method: req.method,
                    url: req.url,
                    headers: {
                        "user-agent": req.headers["user-agent"],
                        "content-type": req.headers["content-type"],
                    },
                    sessionId: req.params?.session,
                    tenantId: req.params?.tenantId,
                }),
                res: (res: SerializedResponse & { raw?: any }) => {
                    return {
                        statusCode: res.statusCode,
                        body: res.raw?.__eudiploLoggedResponseBody,
                    };
                },
            },
        },
        forRoutes: ["*splat"],
    } as Params;
};
