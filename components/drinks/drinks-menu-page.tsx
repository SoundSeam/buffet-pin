"use client";

import { useTranslation } from "@/components/providers/language-provider";
import { type DrinkMenuCategory } from "@/content/drinks-menu";

const pageCopy = {
  en: {
    menuTitle: "Drink Menu",
    currency: "Prices are in Canadian dollars.",
    availability: "Selection and availability may vary. Please ask our team for details.",
  },
  fr: {
    menuTitle: "Menu des boissons",
    currency: "Les prix sont en dollars canadiens.",
    availability: "La sélection et la disponibilité peuvent varier. Informez-vous auprès de notre équipe.",
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
      <header className="bg-white pb-8 pt-28 lg:pb-10 lg:pt-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-black sm:text-4xl">
              {copy.menuTitle}
            </h1>
          </div>
        </div>
      </header>

      <div id="drink-menu">
        <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
          <div className="space-y-9">
            {categories.map((category) => (
              <section
                key={category.id}
                id={category.id}
                aria-labelledby={`${category.id}-title`}
                className="text-[#062F24]"
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

                <ul className="grid gap-x-12 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
