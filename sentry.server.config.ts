import * as Sentry from "@sentry/nextjs";
import { applySentryPrivacy } from "@/app/lib/sentry/before-send";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  beforeSend: applySentryPrivacy,
});
