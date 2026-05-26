"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { exerciseMediaUi } from "@/app/lib/patient-portal-ui";

export type ExerciseMediaAreaProps = {
  exerciseId?: string;
  exerciseName?: string;
  bodyRegion?: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  language: PatientExerciseLanguage;
  arClass?: string;
};

type VisualRegion =
  | "knee"
  | "hip"
  | "shoulder"
  | "cervical"
  | "lumbar"
  | "ankle"
  | "balance"
  | "general";

function resolveVisualRegion(
  bodyRegion?: string,
  exerciseId?: string,
): VisualRegion {
  const id = (exerciseId ?? "").toLowerCase();
  if (
    id.includes("walking") ||
    id.includes("balance") ||
    id.includes("stance") ||
    id.includes("weight-shift") ||
    id.includes("heel-toe") ||
    id.includes("marching")
  ) {
    return "balance";
  }

  const region = (bodyRegion ?? "").toLowerCase();
  if (region === "knee") return "knee";
  if (region === "hip") return "hip";
  if (region === "shoulder") return "shoulder";
  if (region === "cervical") return "cervical";
  if (region === "lumbar") return "lumbar";
  if (region === "ankle") return "ankle";
  return "general";
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

const STROKE = "#1D9E75";
const STROKE_SOFT = "#9ECDB8";
const STROKE_MUTED = "#C5D9D0";

function RegionVisual({ region }: { region: VisualRegion }) {
  const motionClass = "rasq-media-motion";

  switch (region) {
    case "knee":
      return (
        <svg
          viewBox="0 0 120 100"
          className="h-[88px] w-[110px]"
          aria-hidden
        >
          <line x1="58" y1="18" x2="58" y2="42" stroke={STROKE_MUTED} strokeWidth="2.5" strokeLinecap="round" />
          <path
            className={motionClass}
            d="M58 42 Q72 58 58 78 L58 88"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="58" cy="58" r="6" fill="none" stroke={STROKE_SOFT} strokeWidth="2" className={motionClass} style={{ animationDelay: "0.4s" }} />
        </svg>
      );
    case "hip":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <line x1="60" y1="16" x2="60" y2="38" stroke={STROKE_MUTED} strokeWidth="2.5" strokeLinecap="round" />
          <path
            className={motionClass}
            d="M60 38 Q44 52 48 78 L48 90"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className={motionClass}
            d="M48 52 Q68 48 72 62"
            fill="none"
            stroke={STROKE_SOFT}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ animationDelay: "0.35s" }}
          />
        </svg>
      );
    case "shoulder":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <line x1="52" y1="28" x2="52" y2="78" stroke={STROKE_MUTED} strokeWidth="2.5" strokeLinecap="round" />
          <path
            className={motionClass}
            d="M52 32 Q78 36 84 56 Q80 72 58 68"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    case "cervical":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <circle cx="60" cy="24" r="12" fill="none" stroke={STROKE_MUTED} strokeWidth="2" />
          <path
            className={motionClass}
            d="M60 36 L60 52 Q54 58 60 64"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line x1="60" y1="64" x2="60" y2="82" stroke={STROKE_SOFT} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "lumbar":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <path
            className={motionClass}
            d="M60 18 Q68 34 60 50 Q52 66 60 82"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M48 30 L72 30 M46 50 L74 50 M48 70 L72 70"
            fill="none"
            stroke={STROKE_SOFT}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );
    case "ankle":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <line x1="58" y1="14" x2="58" y2="58" stroke={STROKE_MUTED} strokeWidth="2.5" strokeLinecap="round" />
          <path
            className={motionClass}
            d="M58 58 L42 78 L58 88 L74 78 Z"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            className={motionClass}
            d="M42 78 Q58 72 74 78"
            fill="none"
            stroke={STROKE_SOFT}
            strokeWidth="2"
            style={{ animationDelay: "0.3s" }}
          />
        </svg>
      );
    case "balance":
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <line x1="60" y1="22" x2="60" y2="42" stroke={STROKE_MUTED} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="42" x2="60" y2="72" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="72" x2="48" y2="88" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="72" x2="72" y2="88" stroke={STROKE_SOFT} strokeWidth="2.5" strokeLinecap="round" className={motionClass} />
          <path
            className={motionClass}
            d="M36 88 Q60 76 84 88"
            fill="none"
            stroke={STROKE_SOFT}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 100" className="h-[88px] w-[110px]" aria-hidden>
          <path
            className={motionClass}
            d="M20 50 Q40 32 60 50 T100 50"
            fill="none"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className={motionClass}
            d="M20 62 Q40 44 60 62 T100 62"
            fill="none"
            stroke={STROKE_SOFT}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ animationDelay: "0.45s" }}
          />
        </svg>
      );
  }
}

function PlaceholderGuide({
  language,
  exerciseId,
  bodyRegion,
  arClass,
}: {
  language: PatientExerciseLanguage;
  exerciseId?: string;
  bodyRegion?: string;
  arClass: string;
}) {
  const ui = exerciseMediaUi(language);
  const visual = resolveVisualRegion(bodyRegion, exerciseId);
  const isArabic = language === "ar";

  return (
    <div
      className={`flex min-h-[180px] flex-col items-center justify-center gap-3 px-5 py-6 ${arClass}`}
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
    >
      <div className="flex items-center justify-center rounded-full bg-white/70 p-4 shadow-sm ring-1 ring-[#D1E7DE]/80">
        <RegionVisual region={visual} />
      </div>
      <div className="max-w-[260px] text-center">
        <p className="text-[13px] font-semibold tracking-wide text-[#0A0F1A]">
          {ui.movementGuideTitle}
        </p>
        <p className="mt-1 text-[12px] text-[#6B7280]">{ui.demoMediaSubtitle}</p>
        <p className="mt-2 text-[11px] text-[#1D9E75]">
          {ui.followTherapistInstructions}
        </p>
      </div>
      <style>{`
        .rasq-media-motion {
          animation: rasqGuidePulse 4s ease-in-out infinite;
        }
        @keyframes rasqGuidePulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/**
 * Exercise media container for patient session cards.
 * MVP: illustrated movement guide or optional static media URL.
 *
 * Future extension points (not implemented):
 * - camera consent slot
 * - camera preview slot
 * - CV overlay slot
 * - rep / timer overlay slot
 * - side-by-side video + CV layout
 */
export function ExerciseMediaArea({
  exerciseId,
  exerciseName = "",
  bodyRegion,
  mediaUrl,
  thumbnailUrl,
  language,
  arClass = "",
}: ExerciseMediaAreaProps) {
  const ui = exerciseMediaUi(language);
  const isArabic = language === "ar";
  const resolvedMedia = mediaUrl?.trim() || null;
  const poster = thumbnailUrl?.trim() || undefined;

  return (
    <div
      className="relative overflow-hidden border-b border-[#D1E7DE] bg-gradient-to-b from-[#F0FAF6] to-[#F4F6F5]"
      data-exercise-id={exerciseId ?? undefined}
    >
      {/* future: camera consent slot */}
      {/* future: camera preview slot */}

      <div className="relative">
        {resolvedMedia ? (
          <div className="relative min-h-[180px] w-full bg-[#0A0F1A]/5">
            {isVideoUrl(resolvedMedia) ? (
              <video
                className="max-h-[220px] w-full object-contain"
                src={resolvedMedia}
                poster={poster}
                controls
                playsInline
                preload="metadata"
                aria-label={ui.mediaAlt(exerciseName)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedMedia}
                alt={ui.mediaAlt(exerciseName)}
                className="max-h-[220px] w-full object-contain"
              />
            )}
            {/* future: CV overlay slot */}
            {/* future: rep / timer overlay slot */}
          </div>
        ) : (
          <PlaceholderGuide
            language={language}
            exerciseId={exerciseId}
            bodyRegion={bodyRegion}
            arClass={arClass}
          />
        )}
      </div>

      {/* future: side-by-side video + CV layout wrapper */}
    </div>
  );
}
