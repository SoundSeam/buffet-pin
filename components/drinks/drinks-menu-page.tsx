"use client";

import type { DrinkMenuCategory } from "@/content/drinks-menu";
import { useTranslation } from "@/components/providers/language-provider";

export default function DrinksMenuPage({ categories }: { categories: DrinkMenuCategory[] }) {
  const { language } = useTranslation();
  const fr = language === "fr";
  const currency = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:pt-36">
      <header className="mb-12 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#C9A76B]">Buffet PIN</p>
        <h1 className="font-serif text-4xl sm:text-6xl">{fr ? "La carte des boissons" : "Drinks menu"}</h1>
        <p className="mt-4 text-base text-white/65">{fr ? "Boissons fraîches et mocktails sans alcool." : "Soft drinks and refreshing mocktails."}</p>
        {categories.length > 1 && <div className="mt-7 flex flex-wrap justify-center gap-3" aria-label={fr ? "Catégories" : "Categories"}>
          {categories.map((category) => <a key={category.id} href={`#${category.id}`} className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/85 transition hover:border-[#C9A76B] hover:text-[#E7C890] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A76B]">{category.name[language]}</a>)}
        </div>}
      </header>
      {categories.length === 0 && <p className="py-16 text-center text-white/70">{fr ? "Notre carte sera bientôt disponible. Renseignez-vous auprès de notre équipe." : "Our menu will be available soon. Please ask our team."}</p>}
      {categories.map((category) => <section key={category.id} id={category.id} className="mb-16 scroll-mt-28" aria-labelledby={`${category.id}-title`}>
        <div className="mb-7 flex items-center gap-5">
          <h2 id={`${category.id}-title`} className="font-serif text-2xl sm:text-3xl">{category.name[language]}</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#C9A76B]/40 to-transparent" />
        </div>
        <div className={`grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-6 ${category.items.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-3 lg:grid-cols-4"}`}>
          {category.items.map((item, index) => <article key={item.id ?? item.name.en} className="group min-w-0 rounded-2xl border border-white/[0.08] bg-[#101314] p-3 sm:p-5">
            <div className="relative mb-4 aspect-square rounded-xl bg-[radial-gradient(ellipse_at_center,_rgba(192,156,95,0.09),_transparent_70%)]">
              {item.imageUrl && <img src={item.imageUrl} width={1254} height={1254} alt={item.name[language]} loading={index < 4 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-contain transition-transform duration-500 motion-safe:group-hover:scale-[1.025]" />}
            </div>
            <div className="px-1 pb-2 sm:px-2">
              <h3 className="text-base font-semibold leading-snug text-[#F5F0E7] sm:text-xl">{item.name[language]}</h3>
              {item.description?.[language] && <p className="mt-2 text-sm leading-relaxed text-[#B4B7B6]">{item.description[language]}</p>}
              {item.price !== null && <p className="mt-4 text-base font-semibold tabular-nums text-[#E4C38A]" data-testid="drink-price">{currency.format(item.price)}</p>}
            </div>
          </article>)}
        </div>
      </section>)}
      <p className="text-center text-xs leading-relaxed text-white/50">{fr ? "Selon la disponibilité. Prix en dollars canadiens, lorsqu’indiqués." : "Subject to availability. Prices in Canadian dollars, where shown."}</p>
    </div>
  );
}
