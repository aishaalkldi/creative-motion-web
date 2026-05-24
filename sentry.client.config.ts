import * as Sentry from "@sentry/nextjs";
import { applySentryPrivacy } from "@/app/lib/sentry/before-send";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Low sample rate for MVP pilot — adjust later
  tracesSampleRate: 0.1,

  // Do NOT capture user identity
  // No PII attached to errors
  beforeSend: applySentryPrivacy,
});
