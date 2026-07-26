"use client";

import { useMemo } from "react";
import type { ProgramSession } from "@/app/lib/rehab-programs/rehab-program-types";
import { convertCatalogProgramSession } from "@/app/lib/rehab-programs/catalog-session-player-conversion";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import type { InteractiveShoulderSessionProps } from "@/app/lib/interactive-shoulder/orchestrator-cv-session-types";
import { OrchestratorCvSessionCore } from "./OrchestratorCvSessionCore";

export type CatalogSessionPlayerProps = InteractiveShoulderSessionProps & {
  programSession: ProgramSession;
};

export function CatalogSessionPlayer({
  programSession,
  language,
  arClass = "",
  textDir = "ltr",
  ...runtimeProps
}: CatalogSessionPlayerProps) {
  const ui = interactiveShoulderUi(language);
  const conversion = useMemo(
    () => convertCatalogProgramSession(programSession),
    [programSession],
  );

  if (!conversion.ok) {
    return (
      <div
        className={`rounded-[10px] border border-rose-200 bg-rose-50 p-4 ${arClass}`}
        dir={textDir}
        lang={language}
        role="alert"
      >
        <p className="text-sm font-semibold text-rose-800">{ui.catalogSessionConfigErrorTitle}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-rose-700">
          {ui.catalogSessionConfigErrorDescription}
        </p>
      </div>
    );
  }

  return (
    <OrchestratorCvSessionCore
      {...runtimeProps}
      language={language}
      arClass={arClass}
      textDir={textDir}
      sessionDefinition={conversion.sessionDefinition}
    />
  );
}
