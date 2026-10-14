import source from "@/content/official-delivery-menu.json";

type Localized = { fr: string; en: string };
export type DisplayItem = {
  id: string;
  number: number | null;
  name: Localized;
  description: Localized;
  priceCents: number;
  serves: number | null;
  components: { name: Localized; quantity: number | null }[];
};
export type DisplayCategory = { id: string; name: Localized; items: DisplayItem[] };

// Public presentation only: starters/soups, mains, rice/noodles, then set meals.
// Keep the approved catalog and printed dish numbers unchanged.
const restaurantCategoryOrder = [
  "appetizers", "dumplings", "soup",
  "chicken", "beef", "pork", "seafood", "vegetarian", "chop-suey",
  "rice", "noodles", "macaroni", "combos",
];

export function buildDisplayMenu(menu = source): DisplayCategory[] {
  const categoryKeys = new Set(menu.categories.map(category => category.key));
  const itemKeys = new Set(menu.items.map(item => item.key));
  if (categoryKeys.size !== menu.categories.length || itemKeys.size !== menu.items.length ||
      menu.currency !== "CAD" || menu.pricesIncludeTax !== false ||
      menu.categories.some(category => !/^[a-z0-9-]+$/.test(category.key)) ||
      menu.items.some(item => !categoryKeys.has(item.categoryKey) ||
        !Number.isSafeInteger(item.priceCents) || item.priceCents <= 0 || !item.nameFr || !item.nameEn)) {
    throw new Error("Invalid public display menu");
  }
  return [...menu.categories].sort((a, b) => {
    const aIndex = restaurantCategoryOrder.indexOf(a.key);
    const bIndex = restaurantCategoryOrder.indexOf(b.key);
    return (aIndex < 0 ? restaurantCategoryOrder.length : aIndex) -
      (bIndex < 0 ? restaurantCategoryOrder.length : bIndex) || a.sortOrder - b.sortOrder;
  }).map(category => ({
    id: `food-${category.key}`,
    name: { fr: category.nameFr, en: category.nameEn },
    items: menu.items.filter(item => item.categoryKey === category.key).map(item => ({
      id: item.key,
      number: item.printedNumber,
      name: { fr: item.nameFr, en: item.nameEn },
      description: { fr: item.descriptionFr ?? "", en: item.descriptionEn ?? "" },
      priceCents: item.priceCents,
      serves: "serves" in item ? item.serves ?? null : null,
      components: ("components" in item ? item.components ?? [] : []).map(component => ({
        name: { fr: component.nameFr, en: component.nameEn }, quantity: component.quantity,
      })),
    })),
  })).filter(category => category.items.length > 0);
}
