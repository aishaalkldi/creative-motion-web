"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type GlobalUiLanguage = "en" | "ar";

const STORAGE_KEY = "rasq-global-ui-language";

function readStoredGlobalLanguage(): GlobalUiLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "ar" ? "ar" : "en";
}

type GlobalLanguageContextValue = {
  language: GlobalUiLanguage;
  setLanguage: (language: GlobalUiLanguage) => void;
};

const GlobalLanguageContext = createContext<GlobalLanguageContextValue | null>(null);

export function GlobalLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<GlobalUiLanguage>(() => readStoredGlobalLanguage());

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: (next: GlobalUiLanguage) => setLanguageState(next),
    }),
    [language],
  );

  return (
    <GlobalLanguageContext.Provider value={value}>
      <div className="relative" suppressHydrationWarning>
        <GlobalLanguageToggle />
        {children}
      </div>
    </GlobalLanguageContext.Provider>
  );
}

function GlobalLanguageToggle() {
  const { language, setLanguage } = useGlobalLanguage();
  const isArabic = language === "ar";

  return (
    <button
      type="button"
      onClick={() => setLanguage(isArabic ? "en" : "ar")}
      className="fixed right-4 top-4 z-[60] rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5]"
      aria-label={isArabic ? "Switch to English" : "Switch to Arabic"}
      dir="ltr"
      suppressHydrationWarning
    >
      {isArabic ? "English" : "العربية"}
    </button>
  );
}

export function useGlobalLanguage() {
  const context = useContext(GlobalLanguageContext);

  if (!context) {
    throw new Error("useGlobalLanguage must be used within GlobalLanguageProvider");
  }

  return context;
}
