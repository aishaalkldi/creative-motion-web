"use client";

import type { TimelineEvent, TimelineEventSeverity } from "@/app/lib/clinician/patient-timeline";
import { formatTimelineTimestamp } from "@/app/lib/clinician/patient-timeline";

type PatientJourneyTimelineProps = {
  events: TimelineEvent[];
  patientName: string;
};

const DOT_STYLES: Record<TimelineEventSeverity, { border: string; bg: string }> = {
  info: { border: "#374151", bg: "#374151" },
  warning: { border: "#EF9F27", bg: "#EF9F27" },
  action: { border: "#1D9E75", bg: "#1D9E75" },
};

const LABEL_STYLES: Record<TimelineEventSeverity, string> = {
  info: "text-[#F9FAFB]",
  warning: "text-[#EF9F27]",
  action: "text-[#1D9E75]",
};

export function PatientJourneyTimeline({ events, patientName }: PatientJourneyTimelineProps) {
  return (
    <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 scroll-mt-6">
      <h2
        className="mb-3 text-[12px] font-medium text-[#F9FAFB]"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
      >
        Rehabilitation Journey
      </h2>
      <p className="mb-4 text-[11px] text-white/35">
        Chronological record for {patientName}. Events are factual; clinical interpretation is yours.
      </p>

      {events.length === 0 ? (
        <p className="text-[12px] italic text-[#6B7280]">
          No rehabilitation events recorded yet.
        </p>
      ) : (
        <div className="relative pl-6">
          <div
            className="absolute bottom-0 left-[7px] top-0 w-px bg-[#1E2D42]"
            aria-hidden
          />
          <ul className="space-y-0">
            {events.map((event, index) => {
              const severity: TimelineEventSeverity = event.severity ?? "info";
              const dot = DOT_STYLES[severity];
              const isLast = index === events.length - 1;

              return (
                <li
                  key={event.id}
                  className={`relative py-2.5 pl-4 ${
                    isLast ? "" : "border-b border-[#1E2D42]"
                  }`}
                  style={{ borderBottomWidth: isLast ? undefined : "0.5px" }}
                >
                  <span
                    className="absolute left-[-13px] top-[14px] h-2 w-2 rounded-full"
                    style={{
                      border: `2px solid ${dot.border}`,
                      backgroundColor: dot.bg,
                    }}
                    aria-hidden
                  />
                  <p className="text-[10px] text-[#6B7280]">
                    {formatTimelineTimestamp(event.timestamp)}
                  </p>
                  <p className={`mt-0.5 text-[13px] font-medium ${LABEL_STYLES[severity]}`}>
                    {event.label}
                  </p>
                  {event.detail && (
                    <p className="mt-0.5 text-[11px] leading-[1.5] text-[#6B7280]">
                      {event.detail}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
