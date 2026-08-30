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
      className="fixed bottom-4 right-4 z-[60] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)] shadow-[var(--shadow-card)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
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
