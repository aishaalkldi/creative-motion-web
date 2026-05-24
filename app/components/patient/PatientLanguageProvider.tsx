"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  normalizeApiPatientLanguage,
  readStoredPatientLanguage,
  writeStoredPatientLanguage,
} from "@/app/lib/patient-language-preference";
import { portalTextDir } from "@/app/lib/patient-portal-ui";

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type PatientLanguageContextValue = {
  language: PatientExerciseLanguage;
  setLanguage: (language: PatientExerciseLanguage) => void;
  assignedBy: string;
  isArabic: boolean;
  textDir: "rtl" | "ltr";
  arClass: string;
};

const PatientLanguageContext = createContext<PatientLanguageContextValue | null>(null);

export function PatientLanguageProvider({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<PatientExerciseLanguage>("en");
  const [assignedBy, setAssignedBy] = useState("");

  useEffect(() => {
    if (!token) return;

    const stored = readStoredPatientLanguage(token);
    if (stored) {
      setLanguageState(stored);
    }

    fetch(`/api/patient/plan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as PatientPlanData;
        if (data.assignedBy) setAssignedBy(data.assignedBy);
        if (!readStoredPatientLanguage(token)) {
          setLanguageState(normalizeApiPatientLanguage(data.patientLanguage));
        }
      })
      .catch(() => {
        /* assignedBy and API fallback are cosmetic */
      });
  }, [token]);

  const setLanguage = useCallback(
    (next: PatientExerciseLanguage) => {
      if (token) writeStoredPatientLanguage(token, next);
      setLanguageState(next);
    },
    [token],
  );

  const isArabic = language === "ar";
  const textDir = portalTextDir(language);
  const arClass = isArabic ? arabicFont.className : "";

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      assignedBy,
      isArabic,
      textDir,
      arClass,
    }),
    [language, setLanguage, assignedBy, isArabic, textDir, arClass],
  );

  return (
    <PatientLanguageContext.Provider value={value}>
      {children}
    </PatientLanguageContext.Provider>
  );
}

export function usePatientLanguage(): PatientLanguageContextValue {
  const context = useContext(PatientLanguageContext);
  if (!context) {
    throw new Error("usePatientLanguage must be used within PatientLanguageProvider");
  }
  return context;
}
