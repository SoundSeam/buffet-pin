"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations, type Language, type TranslationCopy } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  copy: TranslationCopy;
};

const STORAGE_KEY = "buffet-pin-language";
const DEFAULT_LANGUAGE: Language = "fr";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getPreferredLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(STORAGE_KEY);

  if (storedLanguage === "en" || storedLanguage === "fr") {
    return storedLanguage;
  }

  return window.navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    setLanguage(getPreferredLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        copy: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useTranslation must be used within LanguageProvider.");
  }

  return context;
}
