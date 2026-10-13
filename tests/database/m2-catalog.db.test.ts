import { CatalogEntityType, CatalogMappingStatus, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CatalogMappingError,
  catalogFingerprint,
  validateCheckoutCatalogMappings,
} from "../../lib/orders/catalog";
import { refreshCatalogMappings, verifyCatalogMapping } from "../../lib/orders/catalog-sync";
import { FakeCatalogProvider } from "../../lib/providers/catalog";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({
  datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL),
});
const suffix = Date.now().toString(36);
let ids: { category: string; item: string; group: string; option: string };

beforeAll(async () => {
  const category = await prisma.menuCategory.create({ data: { name: `M2 category ${suffix}` } });
  const item = await prisma.menuItem.create({
    data: { categoryId: category.id, name: `M2 item ${suffix}`, priceCents: 1200 },
  });
  const group = await prisma.modifierGroup.create({
    data: { name: `M2 group ${suffix}`, minSelections: 0, maxSelections: 1 },
  });
  const option = await prisma.modifierOption.create({
    data: { modifierGroupId: group.id, name: `M2 option ${suffix}`, priceDeltaCents: 100 },
  });
  await prisma.menuItemModifierGroup.create({
    data: { menuItemId: item.id, modifierGroupId: group.id },
  });
  ids = { category: category.id, item: item.id, group: group.id, option: option.id };
});

afterAll(() => prisma.$disconnect());

describe("M2 Clover catalog mappings", () => {
  it("fails closed when mappings are absent, stale, or locally changed", async () => {
    await expect(
      validateCheckoutCatalogMappings(prisma, { itemIds: [ids.item], modifierOptionIds: [ids.option] }),
    ).rejects.toBeInstanceOf(CatalogMappingError);

    const verifiedAt = new Date();
    const mappings = [
      [CatalogEntityType.CATEGORY, ids.category, catalogFingerprint({ name: `M2 category ${suffix}`, active: true, delivery: true })],
      [CatalogEntityType.ITEM, ids.item, catalogFingerprint({ name: `M2 item ${suffix}`, priceCents: 1200, active: true, available: true, delivery: true })],
      [CatalogEntityType.MODIFIER_GROUP, ids.group, catalogFingerprint({ name: `M2 group ${suffix}`, min: 0, max: 1, active: true })],
      [CatalogEntityType.MODIFIER_OPTION, ids.option, catalogFingerprint({ name: `M2 option ${suffix}`, priceDeltaCents: 100, active: true, available: true })],
      [CatalogEntityType.TAX_RATE, "quebec-gst", catalogFingerprint({ key: "quebec-gst" })],
      [CatalogEntityType.TAX_RATE, "quebec-qst", catalogFingerprint({ key: "quebec-qst" })],
      [CatalogEntityType.ORDER_TYPE, "delivery", catalogFingerprint({ key: "delivery" })],
      [CatalogEntityType.SERVICE_CHARGE, "delivery-fee", catalogFingerprint({ key: "delivery-fee" })],
    ] as const;
    for (const [entityType, localKey, localFingerprint] of mappings) {
      await prisma.providerCatalogMapping.create({
        data: {
          provider: "clover",
          entityType,
          localKey,
          providerId: `provider-${entityType}-${localKey}`,
          status: CatalogMappingStatus.VERIFIED,
          localFingerprint,
          verifiedAt,
          providerSnapshot: entityType === CatalogEntityType.ITEM
            ? {
                taxRates: {
                  elements: [
                    { id: "provider-TAX_RATE-quebec-gst" },
                    { id: "provider-TAX_RATE-quebec-qst" },
                  ],
                },
              }
            : undefined,
        },
      });
    }
    const resolved = await validateCheckoutCatalogMappings(prisma, {
      itemIds: [ids.item],
      modifierOptionIds: [ids.option],
    });
    expect(resolved.get(`${CatalogEntityType.ITEM}:${ids.item}`)).toBe(
      `provider-${CatalogEntityType.ITEM}-${ids.item}`,
    );

    await prisma.providerCatalogMapping.update({
      where: { provider_entityType_localKey: { provider: "clover", entityType: CatalogEntityType.ITEM, localKey: ids.item } },
      data: { providerSnapshot: { taxRates: { elements: [{ id: "provider-TAX_RATE-quebec-gst" }] } } },
    });
    await expect(
      validateCheckoutCatalogMappings(prisma, { itemIds: [ids.item], modifierOptionIds: [ids.option] }),
    ).rejects.toMatchObject({ blockers: expect.arrayContaining([expect.objectContaining({ code: "TAX_ASSOCIATION_MISSING" })]) });
    await prisma.providerCatalogMapping.update({
      where: { provider_entityType_localKey: { provider: "clover", entityType: CatalogEntityType.ITEM, localKey: ids.item } },
      data: {
        providerSnapshot: {
          taxRates: {
            elements: [
              { id: "provider-TAX_RATE-quebec-gst" },
              { id: "provider-TAX_RATE-quebec-qst" },
            ],
          },
        },
      },
    });

    await prisma.menuItem.update({ where: { id: ids.item }, data: { priceCents: 1300 } });
    await expect(
      validateCheckoutCatalogMappings(prisma, { itemIds: [ids.item], modifierOptionIds: [ids.option] }),
    ).rejects.toMatchObject({ blockers: expect.arrayContaining([expect.objectContaining({ code: "MAPPING_LOCAL_CHANGED" })]) });
  });

  it("compares current Clover identity, price, and availability and refreshes prior verification", async () => {
    const providerId = `clover-item-${ids.item}`;
    const records = new Map<string, unknown>([[`ITEM:${providerId}`, { id: providerId, name: `M2 item ${suffix}`, price: 1300, priceType: "FIXED", available: true, hidden: false, deleted: false }]]);
    const provider = new FakeCatalogProvider(records);
    const verified = await verifyCatalogMapping(prisma, provider, { entityType: CatalogEntityType.ITEM, localKey: ids.item, providerId });
    expect(verified.status).toBe(CatalogMappingStatus.VERIFIED);

    records.set(`ITEM:${providerId}`, { id: providerId, name: `M2 item ${suffix}`, price: 1400, priceType: "FIXED", available: true });
    await refreshCatalogMappings(prisma, provider);
    expect((await prisma.providerCatalogMapping.findUniqueOrThrow({ where: { provider_entityType_localKey: { provider: "clover", entityType: CatalogEntityType.ITEM, localKey: ids.item } } })).status).toBe(CatalogMappingStatus.STALE);
    await expect(validateCheckoutCatalogMappings(prisma, { itemIds: [ids.item], modifierOptionIds: [ids.option] })).rejects.toMatchObject({ blockers: expect.arrayContaining([expect.objectContaining({ localKey: ids.item })]) });

    records.set(`ITEM:${providerId}`, { id: providerId, name: `M2 item ${suffix}`, price: 1300, priceType: "FIXED", available: false });
    const soldOut = await verifyCatalogMapping(prisma, provider, { entityType: CatalogEntityType.ITEM, localKey: ids.item, providerId });
    expect(soldOut).toMatchObject({ status: CatalogMappingStatus.DISABLED, issueCode: "PROVIDER_ENTITY_SOLD_OUT" });
  });

  it("replaces prior verification with ambiguous state after a provider timeout", async () => {
    const mapping = await prisma.providerCatalogMapping.findUniqueOrThrow({ where: { provider_entityType_localKey: { provider: "clover", entityType: CatalogEntityType.ITEM, localKey: ids.item } } });
    const timeoutProvider = { read: async () => { throw new Error("timeout"); } };
    const observed = await verifyCatalogMapping(prisma, timeoutProvider, { entityType: CatalogEntityType.ITEM, localKey: ids.item, providerId: mapping.providerId });
    expect(observed).toMatchObject({ status: CatalogMappingStatus.AMBIGUOUS, issueCode: "PROVIDER_READ_FAILED" });
  });

  it("persists a visible blocker for every required mapping that was never configured", async () => {
    const category = await prisma.menuCategory.create({ data: { name: `M2 missing category ${crypto.randomUUID()}` } });
    const item = await prisma.menuItem.create({ data: { categoryId: category.id, name: `M2 missing item ${crypto.randomUUID()}`, priceCents: 999 } });
    await refreshCatalogMappings(prisma, new FakeCatalogProvider(new Map()));
    const mapping = await prisma.providerCatalogMapping.findUnique({ where: { provider_entityType_localKey: { provider: "clover", entityType: CatalogEntityType.ITEM, localKey: item.id } } });
    expect(mapping).toMatchObject({ status: CatalogMappingStatus.MISSING, issueCode: "MAPPING_NOT_CONFIGURED" });
  });
});
