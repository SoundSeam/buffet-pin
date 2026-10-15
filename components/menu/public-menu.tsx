"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "@/components/providers/language-provider";
import type { DisplayCategory } from "@/lib/menu/display-menu";

// Reuse OrderFlow typography, search and product grid with drinks-style cutouts.
// Articles replace purchase buttons; no cart is mounted.
export default function PublicMenu({ categories }: { categories: DisplayCategory[] }) {
  const { language } = useTranslation();
  const fr = language === "fr";
  const [searchQuery, setSearchQuery] = useState("");
  const money = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(language);
    if (!query) return categories;
    return categories.map(category => ({
      ...category,
      items: category.items.filter(item => [category.name[language], item.name[language], item.description[language], item.number?.toString() ?? "", ...item.components.map(component => component.name[language])].join(" ").toLocaleLowerCase(language).includes(query)),
    })).filter(category => category.items.length > 0);
  }, [categories, language, searchQuery]);

  return (
    <section data-public-menu className="bg-white pb-20">
      <div className="bg-white pb-10 pt-16 lg:pb-14 lg:pt-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <a data-menu-pickup-banner href="tel:+14506998088" className="block rounded-surface bg-[#062F24] px-6 py-4 text-center text-base font-medium text-white">
            {fr ? "Pour une commande à emporter, appelez le (450) 699-8088." : "Call (450) 699-8088 to place a pickup order."}
          </a>
          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><h1 className="max-w-2xl text-3xl font-semibold leading-tight text-black sm:text-4xl">Buffet Pin</h1></div>
            <div className="relative w-full md:max-w-sm">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
              <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
                placeholder={fr ? "Rechercher dans Buffet Pin" : "Search in Buffet Pin"}
                aria-label={fr ? "Rechercher dans Buffet Pin" : "Search in Buffet Pin"}
                className="h-12 w-full rounded-button bg-neutral-100 px-12 text-base text-black placeholder:text-black/45 focus:bg-white focus:ring-2 focus:ring-black" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-8 min-h-0 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black text-white"
                aria-label={fr ? "Effacer la recherche" : "Clear search"}><X size={16} strokeWidth={2.5} aria-hidden="true" /></button>}
            </div>
          </div>
          <div className="mt-4 max-w-2xl text-sm font-normal leading-5 text-neutral-500">
            <p>{fr ? "Menu pour consultation seulement." : "Menu for viewing only."}</p>
            <p>{fr ? "Prix en dollars canadiens, avant taxes. Selon la disponibilité." : "Prices in Canadian dollars, before tax. Subject to availability."}</p>
            <p>90 Boulevard Saint Jean Baptiste #3,<br />Châteauguay, Québec J6K 3A6</p>
            <Link href="/drinks" className="text-black">{fr ? "Voir la carte des boissons" : "View the drinks menu"}</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-6 lg:hidden">
              <select aria-label={fr ? "Catégorie du menu" : "Menu category"} defaultValue=""
                className="w-full rounded-button border border-neutral-200 bg-neutral-100 px-4 py-3 text-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black"
                onChange={event => { if (event.target.value) { window.location.hash = event.target.value; } }}>
                <option value="" disabled>{fr ? "Catégories" : "Categories"}</option>
                {visibleCategories.map(category => <option key={category.id} value={category.id}>{category.name[language]}</option>)}
              </select>
            </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            {visibleCategories.length === 0 && <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-8 text-[#062F24] shadow-sm">
              {searchQuery ? (fr ? "Aucun plat ne correspond à votre recherche." : "No dishes match your search.") : (fr ? "Notre menu sera bientôt disponible." : "Our menu will be available soon.")}
            </div>}
            {visibleCategories.map((category, categoryIndex) => <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-24">
              <h2 id={`${category.id}-title`} className="text-lg font-extrabold text-[#062F24]">{category.name[language]}</h2>
              <div className="mt-5 grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
                {category.items.map((item, itemIndex) => <article key={item.id} data-menu-item={item.id} className="group block min-h-0 text-left text-[#062F24]">
                  <div className="relative block aspect-square overflow-hidden rounded-surface">
                    <img data-menu-food-image src={item.image.src} width={item.image.width} height={item.image.height}
                      alt={item.name[language]} loading={categoryIndex === 0 && itemIndex < 3 ? "eager" : "lazy"}
                      decoding="async" className="h-full w-full object-contain" />
                  </div>
                  <div className="mt-3">
                    <h3 className="text-base font-medium leading-snug">{item.number !== null ? `${item.number}. ` : ""}{item.name[language]}</h3>
                    <p data-menu-price className="mt-1 block text-sm font-normal leading-none text-[#062F24]/64">{money.format(item.priceCents / 100)}</p>
                  </div>
                  {item.components.length > 0 ? <div className="mt-4 max-w-2xl text-sm font-normal leading-5 text-neutral-500">
                    {item.serves !== null && <p>{fr ? `Pour ${item.serves} personne${item.serves > 1 ? "s" : ""}` : `Serves ${item.serves}`}</p>}
                    <ul>{item.components.map((component, index) => <li key={index}>{component.quantity !== null ? `${component.quantity} × ` : ""}{component.name[language]}</li>)}</ul>
                  </div> : item.description[language] && <p className="mt-4 max-w-2xl text-sm font-normal leading-5 text-neutral-500">{item.description[language]}</p>}
                </article>)}
              </div>
            </section>)}
          </div>
          <aside className="hidden h-fit rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm lg:sticky lg:top-24 lg:block">
            <h2 className="text-lg font-extrabold">{fr ? "Catégories" : "Categories"}</h2>
            <nav aria-label={fr ? "Catégories du menu" : "Menu categories"} className="mt-5 space-y-4">
              {visibleCategories.map(category => <a key={category.id} href={`#${category.id}`} className="block text-base font-medium leading-snug">{category.name[language]}</a>)}
            </nav>
          </aside>
        </div>
        <p className="mt-4 max-w-2xl text-sm font-normal leading-5 text-neutral-500">
          {fr ? "Images générées à titre illustratif. La présentation et les portions peuvent varier." : "Generated images are illustrative. Presentation and portions may vary."}
        </p>
      </div>
    </section>
  );
}
