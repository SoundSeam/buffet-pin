-- CreateTable
CREATE TABLE "DrinkCategory" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrinkCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrinkItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionFr" TEXT,
    "imageUrl" TEXT,
    "priceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrinkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrinkCategory_sortOrder_nameEn_idx" ON "DrinkCategory"("sortOrder", "nameEn");

-- CreateIndex
CREATE INDEX "DrinkItem_categoryId_sortOrder_nameEn_idx" ON "DrinkItem"("categoryId", "sortOrder", "nameEn");

-- AddForeignKey
ALTER TABLE "DrinkItem" ADD CONSTRAINT "DrinkItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DrinkCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the currently published sample menu so the public page remains populated
-- when the database-backed editor is first deployed.
INSERT INTO "DrinkCategory" ("id", "nameEn", "nameFr", "sortOrder", "updatedAt") VALUES
    ('drink-category-cocktails', 'Cocktails', 'Cocktails', 0, CURRENT_TIMESTAMP),
    ('drink-category-wine', 'Wine', 'Vins', 1, CURRENT_TIMESTAMP),
    ('drink-category-beer', 'Beer', 'Bières', 2, CURRENT_TIMESTAMP),
    ('drink-category-sake', 'Sake', 'Saké', 3, CURRENT_TIMESTAMP),
    ('drink-category-spirits', 'Spirits', 'Spiritueux', 4, CURRENT_TIMESTAMP),
    ('drink-category-non-alcoholic', 'Non-Alcoholic', 'Sans alcool', 5, CURRENT_TIMESTAMP),
    ('drink-category-soft-drinks', 'Soft Drinks', 'Boissons gazeuses', 6, CURRENT_TIMESTAMP),
    ('drink-category-tea-coffee', 'Tea & Coffee', 'Thé et café', 7, CURRENT_TIMESTAMP);

INSERT INTO "DrinkItem" ("id", "categoryId", "nameEn", "nameFr", "descriptionEn", "descriptionFr", "priceCents", "sortOrder", "updatedAt") VALUES
    ('drink-lychee-martini', 'drink-category-cocktails', 'Lychee Martini', 'Martini au litchi', 'Vodka, lychee, citrus', 'Vodka, litchi, agrumes', 1200, 0, CURRENT_TIMESTAMP),
    ('drink-classic-mojito', 'drink-category-cocktails', 'Classic Mojito', 'Mojito classique', 'Rum, mint, lime, soda', 'Rhum, menthe, lime, soda', 1100, 1, CURRENT_TIMESTAMP),
    ('drink-aperol-spritz', 'drink-category-cocktails', 'Aperol Spritz', 'Aperol Spritz', 'Aperol, prosecco, soda', 'Aperol, prosecco, soda', 1200, 2, CURRENT_TIMESTAMP),
    ('drink-house-red', 'drink-category-wine', 'House Red', 'Rouge maison', 'Glass', 'Verre', 900, 0, CURRENT_TIMESTAMP),
    ('drink-house-white', 'drink-category-wine', 'House White', 'Blanc maison', 'Glass', 'Verre', 900, 1, CURRENT_TIMESTAMP),
    ('drink-sparkling-wine', 'drink-category-wine', 'Sparkling Wine', 'Vin mousseux', 'Glass', 'Verre', 1000, 2, CURRENT_TIMESTAMP),
    ('drink-domestic-beer', 'drink-category-beer', 'Domestic Beer', 'Bière domestique', 'Bottle', 'Bouteille', 700, 0, CURRENT_TIMESTAMP),
    ('drink-imported-beer', 'drink-category-beer', 'Imported Beer', 'Bière importée', 'Bottle', 'Bouteille', 800, 1, CURRENT_TIMESTAMP),
    ('drink-draft-beer', 'drink-category-beer', 'Draft Beer', 'Bière en fût', 'Pint', 'Pinte', 800, 2, CURRENT_TIMESTAMP),
    ('drink-house-sake', 'drink-category-sake', 'House Sake', 'Saké maison', 'Served warm', 'Servi chaud', 800, 0, CURRENT_TIMESTAMP),
    ('drink-junmai-sake', 'drink-category-sake', 'Junmai Sake', 'Saké junmai', 'Glass', 'Verre', 1000, 1, CURRENT_TIMESTAMP),
    ('drink-plum-sake', 'drink-category-sake', 'Plum Sake', 'Saké aux prunes', 'Glass', 'Verre', 900, 2, CURRENT_TIMESTAMP),
    ('drink-house-pour', 'drink-category-spirits', 'House Pour', 'Spiritueux maison', '1 oz', '1 oz', 700, 0, CURRENT_TIMESTAMP),
    ('drink-premium-pour', 'drink-category-spirits', 'Premium Pour', 'Spiritueux premium', '1 oz', '1 oz', 1000, 1, CURRENT_TIMESTAMP),
    ('drink-cognac', 'drink-category-spirits', 'Cognac', 'Cognac', '1 oz', '1 oz', 1200, 2, CURRENT_TIMESTAMP),
    ('drink-sparkling-water', 'drink-category-non-alcoholic', 'Sparkling Water', 'Eau pétillante', 'Bottle', 'Bouteille', 500, 0, CURRENT_TIMESTAMP),
    ('drink-fresh-lemonade', 'drink-category-non-alcoholic', 'Fresh Lemonade', 'Limonade fraîche', 'Glass', 'Verre', 600, 1, CURRENT_TIMESTAMP),
    ('drink-virgin-mojito', 'drink-category-non-alcoholic', 'Virgin Mojito', 'Mojito sans alcool', 'Mint, lime, soda', 'Menthe, lime, soda', 800, 2, CURRENT_TIMESTAMP),
    ('drink-fountain-soft-drink', 'drink-category-soft-drinks', 'Fountain Soft Drink', 'Boisson gazeuse en fontaine', 'Glass', 'Verre', 400, 0, CURRENT_TIMESTAMP),
    ('drink-juice', 'drink-category-soft-drinks', 'Juice', 'Jus', 'Orange or apple', 'Orange ou pomme', 400, 1, CURRENT_TIMESTAMP),
    ('drink-iced-tea', 'drink-category-soft-drinks', 'Iced Tea', 'Thé glacé', 'Glass', 'Verre', 400, 2, CURRENT_TIMESTAMP),
    ('drink-jasmine-tea', 'drink-category-tea-coffee', 'Jasmine Tea', 'Thé au jasmin', 'Pot', 'Théière', 500, 0, CURRENT_TIMESTAMP),
    ('drink-green-tea', 'drink-category-tea-coffee', 'Green Tea', 'Thé vert', 'Pot', 'Théière', 500, 1, CURRENT_TIMESTAMP),
    ('drink-coffee', 'drink-category-tea-coffee', 'Coffee', 'Café', 'Regular or decaf', 'Régulier ou décaféiné', 400, 2, CURRENT_TIMESTAMP);
