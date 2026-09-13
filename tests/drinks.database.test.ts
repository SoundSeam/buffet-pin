import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { updateDrink } from "@/lib/drinks/mutations";
const db = new PrismaClient({ datasourceUrl: "postgresql://drinks_test@127.0.0.1:55441/drinks_catalog_test" });
afterAll(() => db.$disconnect());
describe("drink update transactions", () => {
  it("preserves legacy fields across migration", async () => {
    const item = await db.drinkItem.findUniqueOrThrow({ where: { id: "migration-sentinel" } });
    expect(item).toMatchObject({ nameEn: "Preserved drink", priceCents: 475, isVisible: false });
  });
  it("commits price, title and actor audit together", async () => {
    const item = await db.drinkItem.findUniqueOrThrow({ where: { id: "menu-coke" } });
    const updated = await db.$transaction(tx => updateDrink(tx, item.id, { expectedUpdatedAt: item.updatedAt.toISOString(), priceCents: 450, nameEn: "Coke" }, "test-admin"));
    const event = await db.drinkMenuEvent.findFirstOrThrow({ where: { entityId: item.id }, orderBy: { createdAt: "desc" } });
    expect(updated.priceCents).toBe(450); expect(event.actorId).toBe("test-admin"); expect(event.before).toMatchObject({ id: item.id }); expect(event.after).toMatchObject({ priceCents: 450 });
  });
  it("allows one concurrent save and rejects the stale other without a second audit", async () => {
    const item = await db.drinkItem.findUniqueOrThrow({ where: { id: "menu-coke" } });
    const count = await db.drinkMenuEvent.count();
    const result = await Promise.allSettled([500, 600].map(priceCents => db.$transaction(tx => updateDrink(tx, item.id, { expectedUpdatedAt: item.updatedAt.toISOString(), priceCents }, "test-admin"))));
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(await db.drinkMenuEvent.count()).toBe(count + 1);
  });
  it("rolls back the edit and audit on failure, and supports a blank price", async () => {
    const item = await db.drinkItem.findUniqueOrThrow({ where: { id: "menu-coke" } });
    const count = await db.drinkMenuEvent.count();
    await expect(db.$transaction(async tx => { await updateDrink(tx, item.id, { expectedUpdatedAt: item.updatedAt.toISOString(), priceCents: 950 }, "test-admin"); throw new Error("abort"); })).rejects.toThrow("abort");
    expect(await db.drinkMenuEvent.count()).toBe(count);
    expect((await db.drinkItem.findUniqueOrThrow({ where: { id: item.id } })).priceCents).toBe(item.priceCents);
    await db.$transaction(tx => updateDrink(tx, item.id, { expectedUpdatedAt: item.updatedAt.toISOString(), priceCents: null }, "test-admin"));
  });
});
