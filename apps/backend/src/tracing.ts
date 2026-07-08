import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

/**
 * OpenTelemetry SDK bootstrap — must be started BEFORE NestJS initializes.
 *
 * All three signals (metrics, traces, logs) are exported via OTLP to an
 * OpenTelemetry Collector. Configure the collector endpoint via:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT  (default: http://localhost:4318)
 *
 * To disable OTel entirely (e.g. local dev without collector), set:
 *
 *   OTEL_SDK_DISABLED=true
 */
const otelSDK = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "eudiplo-backend",
        [ATTR_SERVICE_VERSION]: process.env.VERSION || "unknown",
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 30_000,
    }),
    logRecordProcessors: [new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter(),        
    })],
    instrumentations: [
        getNodeAutoInstrumentations({
            // fs instrumentation is very noisy and adds little value
            "@opentelemetry/instrumentation-fs": { enabled: false },
            // Enable HTTP metrics (server request duration, etc.)
            "@opentelemetry/instrumentation-http": {
                enabled: true,
            },
        }),
    ],
});

export default otelSDK;

process.on("SIGTERM", () => {
    otelSDK
        .shutdown()
        .then(
            () => console.log("OTel SDK shut down successfully"),
            (err) => console.log("Error shutting down OTel SDK", err),
        )
        .finally(() => process.exit(0));
});
