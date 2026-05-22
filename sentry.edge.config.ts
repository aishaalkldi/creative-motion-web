import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Redact patient and assessment tokens from URLs
    if (event.request?.url) {
      event.request.url = event.request.url
        .replace(
          /\/patient\/[^/?#]+/g,
          "/patient/[token-redacted]",
        )
        .replace(
          /\/assessment\/[^/?#]+/g,
          "/assessment/[token-redacted]",
        );
    }

    // Strip sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }

    // Never send user identity
    delete event.user;

    return event;
  },
});
