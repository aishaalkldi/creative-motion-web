"use client";

import { resolveInteractiveShoulderSessionFromEnv } from "@/app/lib/interactive-shoulder/resolve-interactive-shoulder-session";
import type { InteractiveShoulderSessionProps } from "@/app/lib/interactive-shoulder/orchestrator-cv-session-types";
import { OrchestratorCvSessionCore } from "./OrchestratorCvSessionCore";

const LEGACY_INTERACTIVE_SHOULDER_SESSION = resolveInteractiveShoulderSessionFromEnv();

export type { InteractiveShoulderSessionProps };

export function InteractiveShoulderSession(props: InteractiveShoulderSessionProps) {
  return (
    <OrchestratorCvSessionCore
      {...props}
      sessionDefinition={LEGACY_INTERACTIVE_SHOULDER_SESSION}
    />
  );
}
