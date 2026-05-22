import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Low sample rate for MVP pilot — adjust later
  tracesSampleRate: 0.1,

  // Do NOT capture user identity
  // No PII attached to errors
  beforeSend(event) {
    // Strip any URL that contains a patient token
    // Patient tokens appear in URLs as /patient/[long-token]
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

    // Strip request headers that may contain session cookies
    if (event.request?.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
    }

    // Do not attach user context
    delete event.user;

    return event;
  },
});
