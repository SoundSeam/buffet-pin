"use client";

import { useTranslation } from "@/components/providers/language-provider";
import { buffetPinMedia } from "@/lib/media";

export default function DrinksMenuPage() {
  const { language } = useTranslation();

  return (
    <div className="mx-auto max-w-7xl px-6 pb-10 pt-20 lg:px-8 lg:pb-12 lg:pt-24">
      <h1 className="sr-only">{language === "fr" ? "Menu des boissons" : "Drink Menu"}</h1>
      <img
        src={buffetPinMedia.drinksMenu}
        width={1700}
        height={2400}
        fetchPriority="high"
        alt={language === "fr"
          ? "Menu des boissons : Coca-Cola, Coke Zero, Canada Dry, Sprite, Fuze, Fruitopia, Fanta, Barq’s, Corona Cero, Perrier, jus Oasis et mocktails mangue coco, thé noir hibiscus et thé jasmin fruit de la passion."
          : "Drink menu: Coca-Cola, Coke Zero, Canada Dry, Sprite, Fuze, Fruitopia, Fanta, Barq’s, Corona Cero, Perrier, Oasis juices, and mango coconut, black tea hibiscus, and jasmine tea passion fruit mocktails."}
        className="block h-auto w-full"
      />
    </div>
  );
}
