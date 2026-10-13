import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
if (process.env.BUFFET_PIN_ENV_ALREADY_LOADED !== "true") {
  loadEnvConfig(process.cwd());
}
const { PrismaClient } = await import("@prisma/client");

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const merchantId = process.env.CLOVER_MERCHANT_ID?.trim();
const token = process.env.CLOVER_PLATFORM_TOKEN?.trim();
const cloverEnvironment = process.env.CLOVER_ENV?.trim();
const apiBase = "https://api.clover.com";
const priceArgument = process.argv.find((value) => value.startsWith("--price-cents="));
const requestedPriceCents = priceArgument ? Number(priceArgument.split("=")[1]) : null;

function fail(message) {
  throw new Error(message);
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function clover(path, init = {}) {
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "User-Agent": "BuffetPinDirect/1.0",
          ...(init.headers ?? {}),
        },
      });
    } catch {
      if (init.method && init.method !== "GET") {
        fail(`Clover ${init.method} outcome is unknown for ${path.replace(merchantId, "{merchant}")}; inspect Clover before retrying.`);
      }
      if (attempt === 2) {
        fail(`Clover could not be reached for ${path.replace(merchantId, "{merchant}")}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) fail(`Clover returned HTTP ${response.status} for ${path.replace(merchantId, "{merchant}")}; no local mapping was written.`);
  return body;
}

function elements(response) {
  return Array.isArray(response?.elements) ? response.elements : [];
}

function assertNamedEntity(entity, expectedName, kind) {
  if (!entity?.id || String(entity.name ?? entity.label).trim() !== expectedName) {
    fail(`${kind} did not match the expected Clover identity.`);
  }
}

async function main() {
  if (!APPLY) fail("Dry run only. Re-run with --apply after reviewing the target.");
  if (requestedPriceCents !== null && (!Number.isInteger(requestedPriceCents) || requestedPriceCents < 1 || requestedPriceCents > 1_000_000)) {
    fail("--price-cents must be an integer between 1 and 1000000.");
  }
  if (cloverEnvironment !== "production") fail(`CLOVER_ENV must be production for this onsite machine-test provisioner (observed ${JSON.stringify(cloverEnvironment ?? null)}).`);
  if (!merchantId || !token) fail("Clover merchant ID and platform token are required.");

  const localItems = await prisma.menuItem.findMany({
    where: { name: "Pork Dumplings", isActive: true, isAvailable: true, isDeliveryChannel: true },
    include: { category: true },
  });
  if (localItems.length !== 1) fail("Expected exactly one active local Pork Dumplings item.");
  const localItem = localItems[0];
  const desiredPriceCents = requestedPriceCents ?? localItem.priceCents;
  const merchantPath = `/v3/merchants/${encodeURIComponent(merchantId)}`;

  const merchant = await clover(merchantPath);
  const categoriesResponse = await clover(`${merchantPath}/categories?limit=1000`);
  const itemsResponse = await clover(`${merchantPath}/items?limit=1000`);
  const gst = await clover(`${merchantPath}/tax_rates/BZYP3HYS7YW82`);
  const qst = await clover(`${merchantPath}/tax_rates/C5MSXE9Y98FGC`);
  const orderType = await clover(`${merchantPath}/order_types/Q22RAFSFEDYNG`);
  if (merchant?.id !== merchantId) fail("Clover returned a different merchant.");
  assertNamedEntity(gst, "TPS", "GST tax rate");
  assertNamedEntity(qst, "TVQ", "QST tax rate");
  assertNamedEntity(orderType, "Delivery", "delivery order type");
  if (String(gst.rate) !== "500000" || String(qst.rate) !== "997500") {
    fail("Clover TPS/TVQ rates do not match the approved Quebec rates.");
  }

  const categoryMatches = elements(categoriesResponse).filter(
    (category) => category?.name?.trim() === localItem.category.name.trim(),
  );
  if (categoryMatches.length > 1) fail(`Clover has multiple exact ${localItem.category.name} categories.`);
  let category = categoryMatches[0];
  let categoryCreated = false;
  if (!category) {
    category = await clover(`${merchantPath}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: localItem.category.name }),
    });
    categoryCreated = true;
  }
  assertNamedEntity(category, localItem.category.name, "category");

  const itemMatches = elements(itemsResponse).filter(
    (item) => item?.name?.trim() === localItem.name.trim(),
  );
  if (itemMatches.length > 1) fail(`Clover has multiple exact ${localItem.name} items.`);
  let item = itemMatches[0];
  let itemCreated = false;
  if (!item) {
    item = await clover(`${merchantPath}/items`, {
      method: "POST",
      body: JSON.stringify({
        name: localItem.name,
        price: desiredPriceCents,
        priceType: "FIXED",
        available: true,
        hidden: false,
        defaultTaxRates: false,
        isRevenue: true,
        categories: [{ id: category.id }],
      }),
    });
    itemCreated = true;
  }

  item = await clover(`${merchantPath}/items/${encodeURIComponent(item.id)}?expand=categories,taxRates`);
  assertNamedEntity(item, localItem.name, "item");
  if (item.price !== desiredPriceCents && requestedPriceCents !== null) {
    await clover(`${merchantPath}/items/${encodeURIComponent(item.id)}`, {
      method: "POST",
      body: JSON.stringify({ price: desiredPriceCents }),
    });
    item = await clover(`${merchantPath}/items/${encodeURIComponent(item.id)}?expand=categories,taxRates`);
  }
  if (item.price !== desiredPriceCents || item.priceType !== "FIXED" || item.available !== true || item.hidden === true || item.defaultTaxRates !== false) {
    fail("The Clover item does not exactly match the local price and availability.");
  }
  let itemCategories = elements(item.categories);
  if (!itemCategories.some((value) => value?.id === category.id)) {
    await clover(`${merchantPath}/category_items`, {
      method: "POST",
      body: JSON.stringify({ elements: [{ category: { id: category.id }, item: { id: item.id } }] }),
    });
    item = await clover(`${merchantPath}/items/${encodeURIComponent(item.id)}?expand=categories,taxRates`);
    itemCategories = elements(item.categories);
  }
  if (!itemCategories.some((value) => value?.id === category.id)) {
    fail("Clover did not confirm the item/category association.");
  }

  let itemTaxRates = elements(item.taxRates);
  const missingTaxRates = [gst, qst].filter(
    (taxRate) => !itemTaxRates.some((value) => value?.id === taxRate.id),
  );
  if (missingTaxRates.length > 0) {
    await clover(`${merchantPath}/tax_rate_items`, {
      method: "POST",
      body: JSON.stringify({
        elements: missingTaxRates.map((taxRate) => ({
          taxRate: { id: taxRate.id },
          item: { id: item.id },
        })),
      }),
    });
    item = await clover(`${merchantPath}/items/${encodeURIComponent(item.id)}?expand=categories,taxRates`);
    itemTaxRates = elements(item.taxRates);
  }
  for (const taxRate of [gst, qst]) {
    if (!itemTaxRates.some((value) => value?.id === taxRate.id)) {
      fail(`Clover did not confirm the ${taxRate.name} tax association for ${item.name}.`);
    }
  }

  const now = new Date();
  const approvalReason = "Owner-present onsite authorization for Buffet Pin Direct live machine testing.";
  const mappings = [
    {
      entityType: "CATEGORY",
      localKey: localItem.category.id,
      providerId: category.id,
      localFingerprint: fingerprint({ name: localItem.category.name, active: localItem.category.isActive, delivery: localItem.category.isDeliveryChannel }),
      snapshot: category,
    },
    {
      entityType: "ITEM",
      localKey: localItem.id,
      providerId: item.id,
      localFingerprint: fingerprint({ name: localItem.name, priceCents: desiredPriceCents, active: localItem.isActive, available: localItem.isAvailable, delivery: localItem.isDeliveryChannel }),
      snapshot: item,
    },
    {
      entityType: "TAX_RATE",
      localKey: "quebec-gst",
      providerId: gst.id,
      localFingerprint: fingerprint({ key: "quebec-gst" }),
      snapshot: gst,
      semanticExpectation: { expectedName: "TPS", expectedRate: "500000", approvalReason, approvedBy: "onsite-owner-authorized" },
    },
    {
      entityType: "TAX_RATE",
      localKey: "quebec-qst",
      providerId: qst.id,
      localFingerprint: fingerprint({ key: "quebec-qst" }),
      snapshot: qst,
      semanticExpectation: { expectedName: "TVQ", expectedRate: "997500", approvalReason, approvedBy: "onsite-owner-authorized" },
    },
    {
      entityType: "ORDER_TYPE",
      localKey: "delivery",
      providerId: orderType.id,
      localFingerprint: fingerprint({ key: "delivery" }),
      snapshot: orderType,
      semanticExpectation: { expectedName: "Delivery", approvalReason, approvedBy: "onsite-owner-authorized" },
    },
  ];

  await prisma.$transaction(async (tx) => {
    await tx.catalogConfiguration.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    if (localItem.priceCents !== desiredPriceCents) {
      await tx.menuItem.update({ where: { id: localItem.id }, data: { priceCents: desiredPriceCents } });
      await tx.operationalAuditEvent.create({
        data: {
          actorType: "SYSTEM", actorLabel: "Onsite catalog provisioner",
          eventType: "MACHINE_TEST_ITEM_PRICE_CHANGED", entityType: "MenuItem", entityId: localItem.id,
          reason: approvalReason,
          metadata: { fromPriceCents: localItem.priceCents, toPriceCents: desiredPriceCents, providerItemId: item.id },
        },
      });
    }
    for (const mapping of mappings) {
      const saved = await tx.providerCatalogMapping.upsert({
        where: { provider_entityType_localKey: { provider: "clover", entityType: mapping.entityType, localKey: mapping.localKey } },
        create: {
          provider: "clover", entityType: mapping.entityType, localKey: mapping.localKey,
          providerId: mapping.providerId, status: "VERIFIED", localFingerprint: mapping.localFingerprint,
          providerFingerprint: fingerprint(mapping.snapshot), providerSnapshot: mapping.snapshot,
          providerUpdatedAt: now, verifiedAt: now,
          semanticExpectation: mapping.semanticExpectation,
          semanticApprovedBy: mapping.semanticExpectation?.approvedBy,
          semanticApprovedAt: mapping.semanticExpectation ? now : undefined,
        },
        update: {
          providerId: mapping.providerId, status: "VERIFIED", localFingerprint: mapping.localFingerprint,
          providerFingerprint: fingerprint(mapping.snapshot), providerSnapshot: mapping.snapshot,
          providerUpdatedAt: now, verifiedAt: now, issueCode: null, issueMessage: null,
          semanticExpectation: mapping.semanticExpectation,
          semanticApprovedBy: mapping.semanticExpectation?.approvedBy,
          semanticApprovedAt: mapping.semanticExpectation ? now : null,
        },
      });
      await tx.operationalAuditEvent.create({
        data: {
          actorType: "SYSTEM", actorLabel: "Onsite catalog provisioner",
          eventType: "CATALOG_MAPPING_OBSERVED", entityType: "ProviderCatalogMapping", entityId: saved.id,
          reason: approvalReason,
          metadata: { entityType: mapping.entityType, localKey: mapping.localKey, providerId: mapping.providerId, status: "VERIFIED" },
        },
      });
    }
  });

  console.log(JSON.stringify({
    ok: true,
    merchant: merchant.name ?? merchant.id,
    category: { name: category.name, id: category.id, created: categoryCreated },
    item: {
      name: item.name,
      priceCents: item.price,
      id: item.id,
      created: itemCreated,
      taxRates: [gst, qst].map((taxRate) => ({ id: taxRate.id, name: taxRate.name, rate: taxRate.rate })),
    },
    mappings: mappings.map(({ entityType, localKey, providerId }) => ({ entityType, localKey, providerId })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
