import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Credentials are supplied by the operator; this script never loads a dotenv file.
const data = JSON.parse(readFileSync(new URL("../content/drinks-catalog.json", import.meta.url)));
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const actorId = process.env.DRINKS_IMPORT_ACTOR;
const backup = process.env.DRINKS_BACKUP_PATH;
try {
  const [existingCategories, existingItems] = await Promise.all([db.drinkCategory.count(), db.drinkItem.count()]);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", existingCategories, existingItems, catalogItems: data.items.length }));
  if (apply) {
    if (!actorId || !backup || existsSync(resolve(backup))) throw new Error("Set DRINKS_IMPORT_ACTOR and a new DRINKS_BACKUP_PATH before applying.");
    const categories = await db.drinkCategory.findMany({ include: { items: true } });
    writeFileSync(backup, JSON.stringify(categories, null, 2), { mode: 0o600, flag: "wx" });
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE "DrinkCategory", "DrinkItem" IN SHARE ROW EXCLUSIVE MODE`;
      // One-time import marker: repeat runs must not overwrite staff changes.
      if (await tx.drinkMenuEvent.findUnique({ where: { id: "drinks-catalog-2026-09-13" } })) return;
      const before = await tx.drinkCategory.findMany({ include: { items: true } });
      const ids = new Set(data.items.map(i => i.id));
      if (before.some(c => c.items.some(i => ids.has(i.id)))) throw new Error("Catalog IDs already exist without an import marker; review before importing.");
      await tx.drinkItem.updateMany({ data: { isVisible: false } });
      for (const category of data.categories) await tx.drinkCategory.create({ data: category });
      for (const item of data.items) await tx.drinkItem.create({ data: item });
      await tx.drinkMenuEvent.create({ data: { id: "drinks-catalog-2026-09-13", actorId, action: "catalog.import", entityId: "drinks-catalog", before: JSON.parse(JSON.stringify(before)), after: data } });
    }, { timeout: 20_000 });
    console.log("Catalog imported; legacy rows retained hidden. Existing staff edits preserved on rerun.");
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
