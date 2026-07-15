"use client";

import Link from "next/link";

import LanguageToggle from "@/components/layout/language-toggle";
import { useTranslation } from "@/components/providers/language-provider";
import {
  drinksMenuIsSample,
  type DrinkMenuCategory,
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

type DrinksMenuPageProps = {
  categories: DrinkMenuCategory[];
};

export default function DrinksMenuPage({ categories }: DrinksMenuPageProps) {
  const { language } = useTranslation();
  const copy = pageCopy[language];
  const currency = new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-white text-[#062F24]">
      <a href="#drink-menu" className="skip-link">
        {language === "fr" ? "Aller au menu" : "Skip to menu"}
      </a>

      <header className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-8 pt-8 lg:px-8 lg:pb-10 lg:pt-10">
          <div className="flex items-end justify-between gap-5">
            <div>
              <Link
                href="/"
                aria-label={copy.home}
                className="inline-flex min-h-0 items-center text-3xl font-semibold leading-tight text-black transition-colors hover:text-[#062F24] sm:text-4xl"
              >
                Buffet Pin
              </Link>
              <h1 className="mt-2 text-sm font-normal leading-5 text-neutral-500">
                {copy.menuTitle}
              </h1>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main id="drink-menu" tabIndex={-1}>
        <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
          {drinksMenuIsSample ? (
            <p className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-[rgba(6,47,36,0.035)] p-4 text-sm font-semibold leading-5 text-[#062F24]">
              {copy.sampleNotice}
            </p>
          ) : null}

          <nav
            aria-label={copy.categoryNav}
            className="-mx-6 overflow-x-auto px-6 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:-mx-8 lg:px-8"
          >
            <div className="flex w-max gap-2">
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="inline-flex min-h-11 items-center rounded-button bg-neutral-100 px-4 text-sm font-bold text-[#062F24] transition-colors hover:bg-neutral-200"
                >
                  {category.name[language]}
                </a>
              ))}
            </div>
          </nav>

          <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <section
                key={category.id}
                id={category.id}
                aria-labelledby={`${category.id}-title`}
                className="h-fit rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm"
              >
                <div className="mb-3 flex items-center gap-4">
                  <h2
                    id={`${category.id}-title`}
                    className="shrink-0 text-lg font-extrabold text-[#062F24]"
                  >
                    {category.name[language]}
                  </h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-[rgba(6,47,36,0.1)]" />
                </div>

                <ul className="divide-y divide-[rgba(6,47,36,0.1)] border-y border-[rgba(6,47,36,0.1)]">
                  {category.items.map((item) => (
                    <li
                      key={item.id ?? item.name.en}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 py-4"
                    >
                      <div className="flex min-w-0 gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-button bg-neutral-100 object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <h3 className="text-base font-medium leading-snug text-[#062F24]">
                            {item.name[language]}
                          </h3>
                          {item.description ? (
                            <p className="mt-1 text-sm font-normal leading-5 text-[#062F24]/64">
                              {item.description[language]}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="tabular-nums pt-0.5 text-sm font-normal leading-5 text-[#062F24]/64">
                        {currency.format(item.price)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <footer className="mt-12 border-t border-[rgba(6,47,36,0.1)] pt-6 text-sm font-normal leading-5 text-neutral-500">
            <p>{copy.currency}</p>
            <p>{copy.availability}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
