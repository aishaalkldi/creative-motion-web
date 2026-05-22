import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Strip patient tokens from server-side error URLs
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

    // Strip cookies and auth headers
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }

    // Never attach user identity
    delete event.user;

    return event;
  },
});
