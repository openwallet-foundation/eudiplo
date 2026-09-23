// OpenTelemetry must be started before importing the application. NestJS and
// Express load Node's HTTP modules during their static import evaluation; once
// that has happened, the HTTP auto-instrumentation can no longer patch them.
if (!process.env.DOC_GENERATE) {
    const { otelSDK } = await import("./tracing.js");
    otelSDK.start();
}

await import("./bootstrap.js");
