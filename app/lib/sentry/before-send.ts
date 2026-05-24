import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const AI_ROUTE_BODY_REDACT =
  /\/api\/(?:assessments\/[^/?#]+\/translate|voice(?:\/|$))/;

const REDACTED_BODY = "[AI request body redacted]";

function redactSensitiveUrls(url: string): string {
  return url
    .replace(/\/patient\/[^/?#]+/g, "/patient/[token-redacted]")
    .replace(/\/assessment\/[^/?#]+/g, "/assessment/[token-redacted]");
}

function redactAiRequestBody(event: ErrorEvent): void {
  const url = event.request?.url ?? "";
  if (!AI_ROUTE_BODY_REDACT.test(url)) return;

  if (event.request?.data !== undefined) {
    event.request.data = REDACTED_BODY;
  }

  if (event.request?.headers) {
    delete event.request.headers["x-openai-key"];
    delete event.request.headers["authorization"];
  }
}

/** Shared Sentry privacy filter — preserves existing redaction and adds AI route body redaction. */
export function applySentryPrivacy(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request?.url) {
    event.request.url = redactSensitiveUrls(event.request.url);
  }

  if (event.request?.headers) {
    delete event.request.headers["cookie"];
    delete event.request.headers["authorization"];
  }

  redactAiRequestBody(event);
  delete event.user;

  return event;
}
