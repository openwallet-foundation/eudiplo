import { RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    const enableHttpLogger = configService.get<boolean>(
        "LOG_ENABLE_HTTP_LOGGER",
        false,
    );

    // Check if file logging is enabled
    const logToFile = configService.get<boolean>("LOG_TO_FILE");
    const logFilePath = configService.get<string>("LOG_FILE_PATH");

    // Check if OTel is disabled
    const otelDisabled =
        configService.get<string>("OTEL_SDK_DISABLED")?.toLowerCase() ===
        "true";
    const logLevel = configService.get("LOG_LEVEL", "info");

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
                ignore: "pid,hostname,req,res,responseTime,context",
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
            autoLogging: enableHttpLogger,
            transport: {
                targets,
            },
            formatters: {
                log: (object: any) => {
                    object.hostname = undefined;
                    return object;
                },
            },
            customProps: (req: any) => ({
                sessionId: req.params?.session,
            }),
            serializers: {
                req: (req: any) => ({
                    method: req.method,
                    url: req.url,
                    headers: {
                        "user-agent": req.headers["user-agent"],
                        "content-type": req.headers["content-type"],
                    },
                    sessionId: req.params?.session,
                    tenantId: req.params?.tenantId,
                }),
                res: (res: any) => ({
                    statusCode: res.statusCode,
                }),
            },
        },
        exclude: [{ path: "/session/:sessionId", method: RequestMethod.ALL }],
    };
};
