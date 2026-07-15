export type LocalizedText = {
  en: string;
  fr: string;
};

export type DrinkMenuItem = {
  id?: string;
  name: LocalizedText;
  description?: LocalizedText;
  imageUrl?: string;
  price: number;
};

export type DrinkMenuCategory = {
  id: string;
  name: LocalizedText;
  items: DrinkMenuItem[];
};

/**
 * Set this to false after replacing the sample items and prices below.
 * Prices are displayed in Canadian dollars.
 */
export const drinksMenuIsSample = true;

/**
 * Fallback content used before the drink-menu database migration is applied.
 * After migration, routine updates are made at /admin/drinks.
 */
export const drinkMenuCategories: DrinkMenuCategory[] = [
  {
    id: "cocktails",
    name: { en: "Cocktails", fr: "Cocktails" },
    items: [
      {
        name: { en: "Lychee Martini", fr: "Martini au litchi" },
        description: {
          en: "Vodka, lychee, citrus",
          fr: "Vodka, litchi, agrumes",
        },
        price: 12,
      },
      {
        name: { en: "Classic Mojito", fr: "Mojito classique" },
        description: {
          en: "Rum, mint, lime, soda",
          fr: "Rhum, menthe, lime, soda",
        },
        price: 11,
      },
      {
        name: { en: "Aperol Spritz", fr: "Aperol Spritz" },
        description: {
          en: "Aperol, prosecco, soda",
          fr: "Aperol, prosecco, soda",
        },
        price: 12,
      },
    ],
  },
  {
    id: "wine",
    name: { en: "Wine", fr: "Vins" },
    items: [
      {
        name: { en: "House Red", fr: "Rouge maison" },
        description: { en: "Glass", fr: "Verre" },
        price: 9,
      },
      {
        name: { en: "House White", fr: "Blanc maison" },
        description: { en: "Glass", fr: "Verre" },
        price: 9,
      },
      {
        name: { en: "Sparkling Wine", fr: "Vin mousseux" },
        description: { en: "Glass", fr: "Verre" },
        price: 10,
      },
    ],
  },
  {
    id: "beer",
    name: { en: "Beer", fr: "Bières" },
    items: [
      {
        name: { en: "Domestic Beer", fr: "Bière domestique" },
        description: { en: "Bottle", fr: "Bouteille" },
        price: 7,
      },
      {
        name: { en: "Imported Beer", fr: "Bière importée" },
        description: { en: "Bottle", fr: "Bouteille" },
        price: 8,
      },
      {
        name: { en: "Draft Beer", fr: "Bière en fût" },
        description: { en: "Pint", fr: "Pinte" },
        price: 8,
      },
    ],
  },
  {
    id: "sake",
    name: { en: "Sake", fr: "Saké" },
    items: [
      {
        name: { en: "House Sake", fr: "Saké maison" },
        description: { en: "Served warm", fr: "Servi chaud" },
        price: 8,
      },
      {
        name: { en: "Junmai Sake", fr: "Saké junmai" },
        description: { en: "Glass", fr: "Verre" },
        price: 10,
      },
      {
        name: { en: "Plum Sake", fr: "Saké aux prunes" },
        description: { en: "Glass", fr: "Verre" },
        price: 9,
      },
    ],
  },
  {
    id: "spirits",
    name: { en: "Spirits", fr: "Spiritueux" },
    items: [
      {
        name: { en: "House Pour", fr: "Spiritueux maison" },
        description: { en: "1 oz", fr: "1 oz" },
        price: 7,
      },
      {
        name: { en: "Premium Pour", fr: "Spiritueux premium" },
        description: { en: "1 oz", fr: "1 oz" },
        price: 10,
      },
      {
        name: { en: "Cognac", fr: "Cognac" },
        description: { en: "1 oz", fr: "1 oz" },
        price: 12,
      },
    ],
  },
  {
    id: "non-alcoholic",
    name: { en: "Non-Alcoholic", fr: "Sans alcool" },
    items: [
      {
        name: { en: "Sparkling Water", fr: "Eau pétillante" },
        description: { en: "Bottle", fr: "Bouteille" },
        price: 5,
      },
      {
        name: { en: "Fresh Lemonade", fr: "Limonade fraîche" },
        description: { en: "Glass", fr: "Verre" },
        price: 6,
      },
      {
        name: { en: "Virgin Mojito", fr: "Mojito sans alcool" },
        description: {
          en: "Mint, lime, soda",
          fr: "Menthe, lime, soda",
        },
        price: 8,
      },
    ],
  },
  {
    id: "soft-drinks",
    name: { en: "Soft Drinks", fr: "Boissons gazeuses" },
    items: [
      {
        name: { en: "Fountain Soft Drink", fr: "Boisson gazeuse en fontaine" },
        description: { en: "Glass", fr: "Verre" },
        price: 4,
      },
      {
        name: { en: "Juice", fr: "Jus" },
        description: { en: "Orange or apple", fr: "Orange ou pomme" },
        price: 4,
      },
      {
        name: { en: "Iced Tea", fr: "Thé glacé" },
        description: { en: "Glass", fr: "Verre" },
        price: 4,
      },
    ],
  },
  {
    id: "tea-coffee",
    name: { en: "Tea & Coffee", fr: "Thé et café" },
    items: [
      {
        name: { en: "Jasmine Tea", fr: "Thé au jasmin" },
        description: { en: "Pot", fr: "Théière" },
        price: 5,
      },
      {
        name: { en: "Green Tea", fr: "Thé vert" },
        description: { en: "Pot", fr: "Théière" },
        price: 5,
      },
      {
        name: { en: "Coffee", fr: "Café" },
        description: { en: "Regular or decaf", fr: "Régulier ou décaféiné" },
        price: 4,
      },
    ],
  },
];
