# Structured logging and request IDs

The application uses Pino and pino-http. Each application log is one JSON line written to stdout, suitable for a container log collector. No CloudWatch or Datadog credentials are required by the application.

## Configuration

| Variable       | Default                             | Purpose                                                             |
| -------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `LOG_LEVEL`    | `info`                              | Minimum severity: trace, debug, info, warn, error, fatal, or silent |
| `SERVICE_NAME` | `DD_SERVICE`, otherwise `tsoadmin`  | Service identity                                                    |
| `DD_ENV`       | `NODE_ENV`, otherwise `development` | Environment identity                                                |
| `DD_VERSION`   | omitted                             | Optional deployed application version                               |

Log records include `timestamp` (UTC ISO timestamp), `level` (Pino numeric severity), `status` (severity name), `service`, `env`, and `message`. HTTP completion logs add `requestId`, `req.method`, `req.path`, `res.statusCode`, and `responseTime` in milliseconds. Successful requests log at info, 4xx at warn, and 5xx at error. Unexpected errors also have a correlated error record with method, path (without query strings), status code, error type, message, and stack. Safe error codes and Prisma client versions are retained, and Error causes are serialized up to three levels with cycle protection. If request middleware is absent, the shared logger is used. Clients still receive the generic error response.

Startup, shutdown, and startup failures use the same JSON logger. Run the compiled server directly in a deployed container (`node dist/src/server.js`) to avoid package-manager banners in its stdout.

## Request correlation

The middleware runs before all routes, including AdminJS, docs, and body parsing. It returns `X-Request-ID` on responses. A supplied ID is retained only if it is 1–128 ASCII characters matching letters, numbers, periods, underscores, colons, or hyphens. Missing or invalid IDs are replaced with a UUID.

```sh
curl -i -H 'X-Request-ID: example-request-123' http://127.0.0.1:3000/health
```

Search logs for `requestId = example-request-123`. Clients can reuse IDs; treat this value as a correlation label, never an identity or authorization claim. When calling another service, explicitly forward the incoming ID if cross-service correlation is desired.

## Application logging

```ts
import { getLogger } from '../logging.js';

getLogger().info({ productId: product.id }, 'Product created');
```

Inside a request, `getLogger()` returns the request-scoped logger, preserving `requestId` across awaited work using AsyncLocalStorage. Outside a request it returns the application logger. Express handlers can also use `req.log`. Do not retain a request logger in a global variable or reuse it for another request. Use an explicit child logger for background jobs with their own correlation fields.

Use structured fields for searchable data and fixed messages for events. Use `logger` from `src/logging.ts` for lifecycle or other process-level events. Use neither console logging nor stringified JSON. Feature validators remain independent of logging, HTTP, and persistence under the architecture rules.

## Sensitive data

Automatic request logs omit headers, bodies, response headers, and URL query strings. Structured fields named `password`, `token`, or `secret` at the top level or one nested level are redacted, as are top-level authorization/cookie fields and request headers/bodies. Error serialization omits arbitrary attached properties. Prisma errors use a generic message with stack frames, avoiding failed-row values and query contents. This is defense in depth, not automatic discovery of secrets: arbitrary fields, URL path segments, messages, and error stacks can still contain sensitive data. Never put credentials or personal data into log messages, exception messages, or unapproved structured fields.

## CloudWatch collection

For ECS/Fargate, configure the application's container with the `awslogs` log driver and the appropriate region, log group, stream prefix, and execution-role permissions. The driver collects stdout/stderr; this application does not call the CloudWatch API. Other runtimes need their own collector or agent.

See [AWS's ECS log collection guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html).

A CloudWatch Logs Insights query after collection:

```text
fields @timestamp, status, message, requestId, req.method, req.path, res.statusCode
| filter requestId = "example-request-123"
| sort @timestamp asc
```

## Datadog collection

Enable log collection in your Datadog Agent or configured container integration and collect this application's stdout as JSON. Match the collector service/environment/version tags to the application's tags. The `message` and `status` fields provide readable messages and severity; verify timestamp parsing and attribute mapping in your pipeline.

See [Datadog's Node.js log collection guide](https://docs.datadoghq.com/logs/log_collection/nodejs/) and [Docker log collection](https://docs.datadoghq.com/containers/docker/log/).

Search collected logs using `service:tsoadmin @requestId:example-request-123`.

Request IDs provide log correlation. Datadog APM traces, W3C trace-context propagation, and automatic log-to-trace linking require separate tracing instrumentation and are not enabled by this change. No collector, cloud deployment, or remote ingestion is configured or verified here.
