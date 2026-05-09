"use client";

import { useTranslation } from "@/components/providers/language-provider";
import type { Language } from "@/lib/i18n";

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

type LanguageToggleProps = {
  mobile?: boolean;
};

export default function LanguageToggle({ mobile = false }: LanguageToggleProps) {
  const { language, setLanguage, copy } = useTranslation();

  return (
    <div
      role="group"
      aria-label={copy.navbar.languageToggle}
      className={`inline-flex items-center rounded-full border border-[#C9A56A]/25 bg-[#062F24] p-1 ${
        mobile ? "w-full justify-center" : ""
      }`}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.value === language;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            className="rounded-full px-3 py-2 text-xs font-semibold tracking-[0.18em] transition-all"
            style={{
              background: active ? "#C9A56A" : "transparent",
              color: active ? "#062F24" : "rgba(244,232,210,0.72)",
            }}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
