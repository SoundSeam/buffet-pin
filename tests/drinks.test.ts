import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), categories: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction, drinkCategory: { findMany: mocks.categories } } }));
vi.mock("@/lib/supabase/auth", () => ({ getAdminUser: mocks.auth }));
import { PATCH, DELETE } from "@/app/api/admin/drinks/items/[id]/route";
import { POST } from "@/app/api/admin/drinks/items/route";
import { GET } from "@/app/api/admin/drinks/route";
import { POST as createCategory } from "@/app/api/admin/drinks/categories/route";
import { PATCH as patchCategory, DELETE as deleteCategory } from "@/app/api/admin/drinks/categories/[id]/route";
import { DrinkConflict } from "@/lib/drinks/mutations";
import { drinkItemUpdateSchema } from "@/lib/drinks/validation";
import { parseDrinkPrice } from "@/lib/drinks/price";
import { getPublicDrinkMenu } from "@/lib/drinks/menu";
const params = { params: Promise.resolve({ id: "drink-test" }) };
const request = (body: unknown) => new Request("http://localhost/api", { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => mocks.auth.mockResolvedValue({ id: "admin-test" }));
describe("drinks editing", () => {
  it("distinguishes blank, zero and exact cents in English and French", () => {
    expect(parseDrinkPrice(" ")).toBeNull(); expect(parseDrinkPrice("0")).toBe(0);
    expect(parseDrinkPrice("4,50")).toBe(450); expect(parseDrinkPrice("12.95")).toBe(1295);
    for (const value of ["-1", "NaN", "1e3", "3.005", "1,2,3", "10000.01"]) expect(() => parseDrinkPrice(value)).toThrow();
  });
  it("title-only updates preserve omitted description, image and price", () => {
    expect(drinkItemUpdateSchema.parse({ nameFr: "Coca", expectedUpdatedAt: "2026-09-13T00:00:00.000Z" })).toEqual({ nameFr: "Coca", expectedUpdatedAt: "2026-09-13T00:00:00.000Z" });
  });
  it("denies all menu mutations and reads before parsing or database work", async () => {
    mocks.auth.mockResolvedValue(null);
    for (const handler of [PATCH, DELETE, patchCategory, deleteCategory]) expect((await handler(request({}), params)).status).toBe(401);
    for (const handler of [POST, createCategory]) expect((await handler(request({}))).status).toBe(401);
    expect((await GET()).status).toBe(401); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects missing revision, empty titles and fractional or coercible prices", async () => {
    for (const value of [{ nameEn: "Coke" }, { expectedUpdatedAt: "2026-09-13T00:00:00.000Z", nameEn: " " }, { expectedUpdatedAt: "2026-09-13T00:00:00.000Z", priceCents: 1.5 }, { expectedUpdatedAt: "2026-09-13T00:00:00.000Z", priceCents: "" }]) expect((await PATCH(request(value), params)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("returns a recoverable 409 for stale saves", async () => {
    mocks.transaction.mockRejectedValue(new DrinkConflict("Changed elsewhere"));
    expect((await PATCH(request({ nameEn: "Coke", expectedUpdatedAt: "2026-09-13T00:00:00.000Z" }), params)).status).toBe(409);
  });
  it("does not turn null prices into zero and filters empty categories", async () => {
    mocks.categories.mockResolvedValue([{ id: "empty", nameEn: "Empty", nameFr: "Vide", items: [] }, { id: "soft", nameEn: "Soft", nameFr: "Boissons", items: [{ id: "coke", nameEn: "Coke", nameFr: "Coke", priceCents: null }, { id: "zero", nameEn: "Zero", nameFr: "Zéro", priceCents: 0 }] }]);
    const menu = await getPublicDrinkMenu();
    expect(menu).toHaveLength(1); expect(menu[0].items.map(i => i.price)).toEqual([null, 0]);
    expect(mocks.categories.mock.calls[0][0].include.items.where).toEqual({ isVisible: true });
  });
  it("database failures stay visible, never display the seed menu", async () => {
    mocks.categories.mockRejectedValue(new Error("offline")); await expect(getPublicDrinkMenu()).rejects.toThrow("offline");
  });
});
