import { createHash } from "node:crypto";
import {
  CatalogEntityType,
  CatalogMappingStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";

type CatalogDb = Prisma.TransactionClient | typeof db;

export class CatalogMappingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly blockers: CatalogBlocker[],
  ) {
    super(message);
    this.name = "CatalogMappingError";
  }
}

export type CatalogBlocker = {
  entityType: CatalogEntityType;
  localKey: string;
  code: string;
  message: string;
};

export function catalogFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export type CatalogExpectation =
  | { kind: "ITEM"; name: string; priceCents: number; active: boolean; available: boolean }
  | { kind: "MODIFIER_OPTION"; name: string; priceCents: number; active: boolean; available: boolean; parentLocalKey: string }
  | { kind: "STRUCTURAL"; name: string; active: boolean }
  | { kind: "LOGICAL"; logicalKey: string; financialKind: "TAX_RATE" | "ORDER_TYPE" | "SERVICE_CHARGE"; active: boolean };

export type RequiredEntity = {
  entityType: CatalogEntityType;
  localKey: string;
  fingerprint: string;
  expectation: CatalogExpectation;
};

function mappingBlockers(
  required: RequiredEntity[],
  mappings: Awaited<ReturnType<CatalogDb["providerCatalogMapping"]["findMany"]>>,
  maxAgeMinutes: number,
  now: Date,
) {
  const byKey = new Map(mappings.map((mapping) => [`${mapping.entityType}:${mapping.localKey}`, mapping]));
  return required.flatMap<CatalogBlocker>((entity) => {
    const mapping = byKey.get(`${entity.entityType}:${entity.localKey}`);
    if (!mapping) {
      return [{ entityType: entity.entityType, localKey: entity.localKey, code: "MAPPING_MISSING", message: "Required Clover mapping is missing." }];
    }
    if (mapping.status !== CatalogMappingStatus.VERIFIED) {
      return [{ entityType: entity.entityType, localKey: entity.localKey, code: `MAPPING_${mapping.status}`, message: mapping.issueMessage ?? `Clover mapping is ${mapping.status.toLowerCase()}.` }];
    }
    if (mapping.localFingerprint !== entity.fingerprint) {
      return [{ entityType: entity.entityType, localKey: entity.localKey, code: "MAPPING_LOCAL_CHANGED", message: "Local catalog changed after mapping verification." }];
    }
    if (!mapping.verifiedAt || now.getTime() - mapping.verifiedAt.getTime() > maxAgeMinutes * 60_000) {
      return [{ entityType: entity.entityType, localKey: entity.localKey, code: "MAPPING_STALE", message: "Clover mapping verification is stale." }];
    }
    return [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemTaxRateIds(snapshot: unknown): Set<string> | null {
  if (!isRecord(snapshot)) return null;
  const taxRates = snapshot.taxRates;
  const values = Array.isArray(taxRates)
    ? taxRates
    : isRecord(taxRates) && Array.isArray(taxRates.elements)
      ? taxRates.elements
      : null;
  if (!values) return null;

  const ids = values.flatMap((value) =>
    isRecord(value) && typeof value.id === "string" ? [value.id] : [],
  );
  return new Set(ids);
}

function taxAssociationBlockers(
  required: RequiredEntity[],
  mappings: Awaited<ReturnType<CatalogDb["providerCatalogMapping"]["findMany"]>>,
) {
  const byKey = new Map(mappings.map((mapping) => [`${mapping.entityType}:${mapping.localKey}`, mapping]));
  const requiredTaxIds = required
    .filter((entity) => entity.entityType === CatalogEntityType.TAX_RATE)
    .flatMap((entity) => {
      const mapping = byKey.get(`${entity.entityType}:${entity.localKey}`);
      return mapping?.status === CatalogMappingStatus.VERIFIED ? [mapping.providerId] : [];
    });

  if (requiredTaxIds.length !== 2) return [];

  return required
    .filter((entity) => entity.entityType === CatalogEntityType.ITEM)
    .flatMap<CatalogBlocker>((entity) => {
      const mapping = byKey.get(`${entity.entityType}:${entity.localKey}`);
      if (!mapping || mapping.status !== CatalogMappingStatus.VERIFIED) return [];
      const observedTaxIds = itemTaxRateIds(mapping.providerSnapshot);
      if (!observedTaxIds) {
        return [{
          entityType: entity.entityType,
          localKey: entity.localKey,
          code: "TAX_ASSOCIATIONS_UNVERIFIED",
          message: "Clover item tax associations were not verified.",
        }];
      }
      const missing = requiredTaxIds.filter((providerId) => !observedTaxIds.has(providerId));
      return missing.length > 0
        ? [{
            entityType: entity.entityType,
            localKey: entity.localKey,
            code: "TAX_ASSOCIATION_MISSING",
            message: "Clover item is not associated with every required Québec tax rate.",
          }]
        : [];
    });
}

export async function loadRequiredCatalogEntities(
  client: CatalogDb,
  itemIds: string[],
  modifierOptionIds: string[],
  requirements: { requireDeliveryServiceCharge?: boolean } = {},
) {
  const [configuration, items, options] = await Promise.all([
    client.catalogConfiguration.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    client.menuItem.findMany({ where: { id: { in: itemIds } }, include: { category: true } }),
    client.modifierOption.findMany({ where: { id: { in: modifierOptionIds } }, include: { modifierGroup: true } }),
  ]);
  const required: RequiredEntity[] = [
    {
      entityType: CatalogEntityType.TAX_RATE,
      localKey: configuration.requiredGstTaxMappingKey,
      fingerprint: catalogFingerprint({ key: configuration.requiredGstTaxMappingKey }),
      expectation: { kind: "LOGICAL", logicalKey: configuration.requiredGstTaxMappingKey, financialKind: "TAX_RATE", active: true },
    },
    {
      entityType: CatalogEntityType.TAX_RATE,
      localKey: configuration.requiredQstTaxMappingKey,
      fingerprint: catalogFingerprint({ key: configuration.requiredQstTaxMappingKey }),
      expectation: { kind: "LOGICAL", logicalKey: configuration.requiredQstTaxMappingKey, financialKind: "TAX_RATE", active: true },
    },
    {
      entityType: CatalogEntityType.ORDER_TYPE,
      localKey: configuration.requiredOrderTypeKey,
      fingerprint: catalogFingerprint({ key: configuration.requiredOrderTypeKey }),
      expectation: { kind: "LOGICAL", logicalKey: configuration.requiredOrderTypeKey, financialKind: "ORDER_TYPE", active: true },
    },
  ];
  if (requirements.requireDeliveryServiceCharge !== false) {
    required.push({
      entityType: CatalogEntityType.SERVICE_CHARGE,
      localKey: configuration.requiredDeliveryFeeMappingKey,
      fingerprint: catalogFingerprint({ key: configuration.requiredDeliveryFeeMappingKey }),
      expectation: { kind: "LOGICAL", logicalKey: configuration.requiredDeliveryFeeMappingKey, financialKind: "SERVICE_CHARGE", active: true },
    });
  }
  for (const item of items) {
    required.push(
      { entityType: CatalogEntityType.CATEGORY, localKey: item.categoryId, fingerprint: catalogFingerprint({ name: item.category.name, active: item.category.isActive, delivery: item.category.isDeliveryChannel }), expectation: { kind: "STRUCTURAL", name: item.category.name, active: item.category.isActive && item.category.isDeliveryChannel } },
      { entityType: CatalogEntityType.ITEM, localKey: item.id, fingerprint: catalogFingerprint({ name: item.name, priceCents: item.priceCents, active: item.isActive, available: item.isAvailable, delivery: item.isDeliveryChannel }), expectation: { kind: "ITEM", name: item.name, priceCents: item.priceCents, active: item.isActive && item.isDeliveryChannel, available: item.isAvailable } },
    );
  }
  for (const option of options) {
    required.push(
      { entityType: CatalogEntityType.MODIFIER_GROUP, localKey: option.modifierGroupId, fingerprint: catalogFingerprint({ name: option.modifierGroup.name, min: option.modifierGroup.minSelections, max: option.modifierGroup.maxSelections, active: option.modifierGroup.isActive }), expectation: { kind: "STRUCTURAL", name: option.modifierGroup.name, active: option.modifierGroup.isActive } },
      { entityType: CatalogEntityType.MODIFIER_OPTION, localKey: option.id, fingerprint: catalogFingerprint({ name: option.name, priceDeltaCents: option.priceDeltaCents, active: option.isActive, available: option.isAvailable }), expectation: { kind: "MODIFIER_OPTION", name: option.name, priceCents: option.priceDeltaCents, active: option.isActive, available: option.isAvailable, parentLocalKey: option.modifierGroupId } },
    );
  }
  const unique = [...new Map(required.map((entity) => [`${entity.entityType}:${entity.localKey}`, entity])).values()];
  return { configuration, required: unique };
}

export async function loadActiveRequiredCatalogEntities(client: CatalogDb) {
  const [items, options] = await Promise.all([
    client.menuItem.findMany({ where: { isActive: true, isDeliveryChannel: true }, select: { id: true } }),
    client.modifierOption.findMany({ where: { isActive: true, modifierGroup: { isActive: true, menuItems: { some: { menuItem: { isActive: true, isDeliveryChannel: true } } } } }, select: { id: true } }),
  ]);
  return loadRequiredCatalogEntities(client, items.map((item) => item.id), options.map((option) => option.id));
}

export async function validateCheckoutCatalogMappings(
  client: CatalogDb,
  input: { itemIds: string[]; modifierOptionIds: string[]; requireDeliveryServiceCharge?: boolean },
  now = new Date(),
) {
  const { configuration, required } = await loadRequiredCatalogEntities(
    client,
    input.itemIds,
    input.modifierOptionIds,
    { requireDeliveryServiceCharge: input.requireDeliveryServiceCharge },
  );
  const mappings = await client.providerCatalogMapping.findMany({
    where: { provider: configuration.provider, OR: required.map((entity) => ({ entityType: entity.entityType, localKey: entity.localKey })) },
  });
  const blockers = [
    ...mappingBlockers(required, mappings, configuration.maxMappingAgeMinutes, now),
    ...taxAssociationBlockers(required, mappings),
  ];
  if (blockers.length) {
    throw new CatalogMappingError("CATALOG_MAPPING_BLOCKED", "Delivery catalog requires manager reconciliation before checkout.", blockers);
  }
  return new Map(mappings.map((mapping) => [`${mapping.entityType}:${mapping.localKey}`, mapping.providerId]));
}

export async function buildCatalogSyncReport(client: CatalogDb = db, now = new Date()) {
  const { configuration, required } = await loadActiveRequiredCatalogEntities(client);
  const mappings = await client.providerCatalogMapping.findMany({ where: { provider: configuration.provider } });
  const blockers = [
    ...mappingBlockers(required, mappings, configuration.maxMappingAgeMinutes, now),
    ...taxAssociationBlockers(required, mappings),
  ];
  return { provider: configuration.provider, ownership: configuration.ownership, checkedAt: now, requiredCount: required.length, verifiedCount: required.length - blockers.length, ready: blockers.length === 0, blockers };
}
