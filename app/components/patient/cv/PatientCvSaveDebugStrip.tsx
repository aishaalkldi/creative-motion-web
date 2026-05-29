"use client";

import type { CvSaveDebugState } from "@/app/lib/cv/cv-qa-debug";
import { isCvQaDebugEnabled } from "@/app/lib/cv/cv-qa-debug";

type PatientCvSaveDebugStripProps = {
  debug: CvSaveDebugState;
  arClass?: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-[10px] leading-snug">
      <span className="font-semibold text-amber-900/80">{label}</span>
      <span className="font-mono text-amber-950">{value}</span>
    </div>
  );
}

export function PatientCvSaveDebugStrip({ debug, arClass = "" }: PatientCvSaveDebugStripProps) {
  if (!isCvQaDebugEnabled()) return null;

  const m = debug.latestMetrics;

  return (
    <div
      className={`border-b border-amber-300 bg-amber-50 px-3 py-3 ${arClass}`}
      data-qa="cv-save-debug-strip"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
        QA debug only — CV save
      </p>
      <p className="mt-1 text-[11px] font-semibold text-amber-950">{debug.headline}</p>
      <ul className="mt-2 space-y-1">
        {debug.lines.map((line) => (
          <li key={line} className="font-mono text-[10px] text-amber-950">
            • {line}
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 rounded-[6px] border border-amber-200 bg-white/60 p-2">
        <p className="text-[10px] font-bold uppercase text-amber-800">Latest metrics</p>
        {m ? (
          <>
            <Row label="sessionDurationS" value={String(m.sessionDurationS)} />
            <Row label="repCount" value={String(m.repCount)} />
            <Row label="trackingQuality" value={m.trackingQuality} />
            <Row label="movementDetected" value={String(m.movementDetected)} />
            <Row label="planSessionId" value={m.planSessionId} />
            <Row label="exerciseId" value={m.exerciseId} />
          </>
        ) : (
          <p className="font-mono text-[10px] text-amber-900">(none in parent ref)</p>
        )}
        <Row label="hasSaved" value={String(debug.flags.hasSaved)} />
        <Row label="saveInProgress" value={String(debug.flags.saveInProgress)} />
        <Row label="skipped" value={String(debug.flags.skipped)} />
        <Row label="flushRegistered" value={String(debug.flags.flushRegistered)} />
      </div>
      {debug.lastResult ? (
        <p className="mt-2 font-mono text-[10px] text-amber-950">
          lastResult: {debug.lastResult}
        </p>
      ) : null}
    </div>
  );
}
