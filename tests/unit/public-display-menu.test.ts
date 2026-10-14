import { describe, expect, it } from "vitest";
import source from "../../content/official-delivery-menu.json";
import { buildDisplayMenu } from "../../lib/menu/display-menu";

describe("public display menu", () => {
  it("presents starters and soups before mains, sides and set meals", () => {
    expect(buildDisplayMenu().map(category => category.id)).toEqual([
      "food-appetizers", "food-dumplings", "food-soup", "food-chicken",
      "food-beef", "food-pork", "food-seafood", "food-vegetarian", "food-chop-suey",
      "food-rice", "food-noodles", "food-macaroni", "food-combos",
    ]);
  });
  it("projects all approved content without publishing import or order configuration", () => {
    const categories = buildDisplayMenu();
    expect(categories).toHaveLength(13);
    const items = categories.flatMap(category => category.items);
    expect(items).toHaveLength(65);
    for (const category of categories) {
      const original = source.categories.find(row => `food-${row.key}` === category.id)!;
      expect(category.name).toEqual({ fr: original.nameFr, en: original.nameEn });
      expect(category.items.map(item => item.id)).toEqual(source.items.filter(item => item.categoryKey === original.key).map(item => item.key));
    }
    for (const item of items) {
      const original = source.items.find(row => row.key === item.id)!;
      expect(item.name).toEqual({ fr: original.nameFr, en: original.nameEn });
      expect(item.priceCents).toBe(original.priceCents);
      expect(item.number).toBe(original.printedNumber);
      expect(item.description).toEqual({ fr: original.descriptionFr ?? "", en: original.descriptionEn ?? "" });
      expect(item.components).toEqual(("components" in original ? original.components ?? [] : []).map(component => ({ name: { fr: component.nameFr, en: component.nameEn }, quantity: component.quantity })));
      expect(item).not.toHaveProperty("availableForDelivery");
      expect(item).not.toHaveProperty("modifierGroups");
    }
    expect(items.find(item => item.id === "combo-7")?.serves).toBe(2);
    expect(items.find(item => item.id === "combo-family")?.serves).toBe(3);
  });

  it("rejects broken references, duplicate IDs and invalid prices", () => {
    for (const mutate of [
      (menu: typeof source) => { menu.items[0].categoryKey = "missing"; },
      (menu: typeof source) => { menu.items[0].key = menu.items[1].key; },
      (menu: typeof source) => { menu.items[0].priceCents = -1; },
      (menu: typeof source) => { menu.categories[0].key = "bad anchor"; },
    ]) {
      const menu = structuredClone(source);
      mutate(menu);
      expect(() => buildDisplayMenu(menu)).toThrow("Invalid public display menu");
    }
  });

  it("supports an empty catalog without sample fallback", () => {
    expect(buildDisplayMenu({ ...source, items: [] })).toEqual([]);
  });
});
