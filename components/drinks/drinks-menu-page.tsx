"use client";

import Link from "next/link";

import LanguageToggle from "@/components/layout/language-toggle";
import { useTranslation } from "@/components/providers/language-provider";
import {
  drinkMenuCategories,
  drinksMenuIsSample,
} from "@/content/drinks-menu";

const pageCopy = {
  en: {
    menuTitle: "Drink Menu",
    sampleNotice: "Preview menu — items and prices are samples.",
    categoryNav: "Drink categories",
    currency: "Prices are in Canadian dollars.",
    availability: "Selection and availability may vary. Please ask our team for details.",
    home: "Buffet Pin home",
  },
  fr: {
    menuTitle: "Menu des boissons",
    sampleNotice: "Menu aperçu — les produits et les prix sont des exemples.",
    categoryNav: "Catégories de boissons",
    currency: "Les prix sont en dollars canadiens.",
    availability: "La sélection et la disponibilité peuvent varier. Informez-vous auprès de notre équipe.",
    home: "Accueil de Buffet Pin",
  },
} as const;

export default function DrinksMenuPage() {
  const { language } = useTranslation();
  const copy = pageCopy[language];
  const currency = new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-[#041F18] text-[#F4E8D2]">
      <a href="#drink-menu" className="skip-link">
        {language === "fr" ? "Aller au menu" : "Skip to menu"}
      </a>

      <header className="border-b border-[#C9A56A]/20">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/"
                aria-label={copy.home}
                className="inline-flex min-h-0 items-center text-sm font-bold uppercase tracking-[0.22em] text-[#C9A56A] transition-colors hover:text-[#E1C38E]"
              >
                Buffet Pin
              </Link>
              <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-[#FFF8EC] sm:text-4xl">
                {copy.menuTitle}
              </h1>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main id="drink-menu" tabIndex={-1}>
        <div className="mx-auto max-w-3xl px-5 pb-14 sm:px-8 sm:pb-20">
          {drinksMenuIsSample ? (
            <p className="mt-5 rounded-surface border border-[#C9A56A]/30 bg-[#C9A56A]/10 px-4 py-3 text-sm leading-5 text-[#F4E8D2] sm:mt-6">
              {copy.sampleNotice}
            </p>
          ) : null}

          <nav
            aria-label={copy.categoryNav}
            className="-mx-5 overflow-x-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:px-8 sm:py-6"
          >
            <div className="flex w-max gap-2">
              {drinkMenuCategories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[#C9A56A]/25 bg-[#062F24] px-4 text-sm font-semibold text-[#E9D8B8] transition-colors hover:border-[#C9A56A]/60 hover:text-white"
                >
                  {category.name[language]}
                </a>
              ))}
            </div>
          </nav>

          <div className="space-y-11 sm:space-y-14">
            {drinkMenuCategories.map((category) => (
              <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`}>
                <div className="mb-3 flex items-center gap-4">
                  <h2
                    id={`${category.id}-title`}
                    className="shrink-0 text-xl font-semibold tracking-[-0.015em] text-[#D9B97F] sm:text-2xl"
                  >
                    {category.name[language]}
                  </h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-[#C9A56A]/20" />
                </div>

                <ul className="divide-y divide-[#C9A56A]/15 border-y border-[#C9A56A]/15">
                  {category.items.map((item) => (
                    <li
                      key={item.name.en}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 py-4 sm:py-5"
                    >
                      <div className="min-w-0">
                        <h3 className="text-[1.0625rem] font-semibold leading-6 text-[#FFF8EC] sm:text-lg">
                          {item.name[language]}
                        </h3>
                        {item.description ? (
                          <p className="mt-1 text-sm leading-5 text-[#CBBFA9] sm:text-[0.9375rem]">
                            {item.description[language]}
                          </p>
                        ) : null}
                      </div>
                      <p className="tabular-nums pt-px text-[1.0625rem] font-semibold leading-6 text-[#FFF8EC] sm:text-lg">
                        {currency.format(item.price)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <footer className="mt-12 border-t border-[#C9A56A]/20 pt-6 text-sm leading-6 text-[#B8AD99] sm:mt-16">
            <p>{copy.currency}</p>
            <p>{copy.availability}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
