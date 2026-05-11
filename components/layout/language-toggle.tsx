"use client";

import { useTranslation } from "@/components/providers/language-provider";
import type { Language } from "@/lib/i18n";

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
];

type LanguageToggleProps = {
  mobile?: boolean;
};

export default function LanguageToggle({ mobile = false }: LanguageToggleProps) {
  const { language, setLanguage, copy } = useTranslation();
  const nextLanguage: Language = language === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={copy.navbar.languageToggle}
      className={`inline-flex min-h-0 items-center rounded border border-white/20 bg-[#062F24] p-1 transition-all ${
        mobile ? "w-full justify-center" : ""
      }`}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.value === language;

        return (
          <span
            key={option.value}
            className="inline-flex min-h-0 items-center rounded-sm px-3 py-2 text-xs font-semibold leading-none transition-all"
            style={{
              background: active ? "#FFFFFF" : "transparent",
              color: active ? "#062F24" : "rgba(255,255,255,0.78)",
            }}
          >
            {option.label}
          </span>
        );
      })}
    </button>
  );
}
