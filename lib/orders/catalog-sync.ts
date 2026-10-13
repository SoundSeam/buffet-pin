import {
  CatalogEntityType,
  CatalogMappingStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { CloverApiError } from "@/lib/clover/client";
import {
  catalogFingerprint,
  loadActiveRequiredCatalogEntities,
  type CatalogExpectation,
  type RequiredEntity,
} from "@/lib/orders/catalog";
import type { CatalogProvider } from "@/lib/providers/catalog";

type Evaluation = {
  status: CatalogMappingStatus;
  issueCode: string | null;
  issueMessage: string | null;
};
export type LogicalSemanticExpectation = { expectedName: string; expectedRate?: string; approvalReason: string; approvedBy: string };

const result = (status: CatalogMappingStatus, issueCode: string | null = null, issueMessage: string | null = null): Evaluation => ({ status, issueCode, issueMessage });
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function malformedBoolean(snapshot: Record<string, unknown>, key: string) {
  return key in snapshot && typeof snapshot[key] !== "boolean";
}

export function evaluateCatalogSnapshot(
  providerId: string,
  expectation: CatalogExpectation,
  snapshot: unknown,
  parentProviderId?: string,
  semanticExpectation?: LogicalSemanticExpectation,
): Evaluation {
  if (!isRecord(snapshot)) return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_SNAPSHOT_MALFORMED", "Clover returned a malformed catalog object.");
  if (typeof snapshot.id !== "string") return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_ID_MISSING", "Clover catalog object omitted its id.");
  if (snapshot.id !== providerId) return result(CatalogMappingStatus.STALE, "PROVIDER_ID_MISMATCH", "Clover returned a different catalog object than requested.");
  for (const key of ["available", "hidden", "deleted", "enabled", "active"]) {
    if (malformedBoolean(snapshot, key)) return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_STATE_MALFORMED", `Clover returned malformed ${key} state.`);
  }
  if (snapshot.deleted === true || snapshot.deletedTime !== undefined && snapshot.deletedTime !== null || snapshot.hidden === true || snapshot.enabled === false || snapshot.active === false) {
    return result(CatalogMappingStatus.DISABLED, "PROVIDER_ENTITY_DISABLED", "Required Clover catalog object is deleted, hidden, or disabled.");
  }

  if (expectation.kind === "LOGICAL") {
    if (!semanticExpectation?.expectedName.trim() || !semanticExpectation.approvalReason.trim() || !semanticExpectation.approvedBy.trim()) return result(CatalogMappingStatus.AMBIGUOUS, "LOGICAL_ATTESTATION_REQUIRED", "A manager must attest the exact Clover name and purpose for financial mappings.");
    const observedName = typeof snapshot.name === "string" ? snapshot.name : typeof snapshot.label === "string" ? snapshot.label : null;
    if (!observedName) return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_NAME_MISSING", "Clover financial object omitted its name or label.");
    if (observedName.trim() !== semanticExpectation.expectedName.trim()) return result(CatalogMappingStatus.STALE, "PROVIDER_NAME_MISMATCH", "Clover financial object name differs from the manager-approved expectation.");
    if (expectation.financialKind === "TAX_RATE") {
      if (!semanticExpectation.expectedRate?.trim()) return result(CatalogMappingStatus.AMBIGUOUS, "TAX_RATE_ATTESTATION_REQUIRED", "Tax mapping requires the manager-approved raw Clover rate.");
      if (snapshot.rate === undefined || String(snapshot.rate) !== semanticExpectation.expectedRate.trim()) return result(CatalogMappingStatus.STALE, "PROVIDER_TAX_RATE_MISMATCH", "Clover tax rate differs from the manager-approved expectation.");
    }
    return result(CatalogMappingStatus.VERIFIED);
  }
  if (typeof snapshot.name !== "string") return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_NAME_MISSING", "Clover catalog object omitted its name.");
  if (snapshot.name.trim() !== expectation.name.trim()) return result(CatalogMappingStatus.STALE, "PROVIDER_NAME_MISMATCH", "Clover name differs from the local delivery catalog.");
  if (!expectation.active) return result(CatalogMappingStatus.DISABLED, "LOCAL_ENTITY_DISABLED", "Local delivery catalog object is disabled.");
  if (expectation.kind === "STRUCTURAL") return result(CatalogMappingStatus.VERIFIED);

  if (typeof snapshot.price !== "number" || !Number.isInteger(snapshot.price)) return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_PRICE_MISSING", "Clover catalog object omitted an integer price.");
  if (snapshot.price !== expectation.priceCents) return result(CatalogMappingStatus.STALE, "PROVIDER_PRICE_MISMATCH", "Clover price differs from the local delivery catalog.");
  if (typeof snapshot.available !== "boolean") return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_AVAILABILITY_MISSING", "Clover catalog object omitted availability.");
  if (!snapshot.available || !expectation.available) return result(CatalogMappingStatus.DISABLED, "PROVIDER_ENTITY_SOLD_OUT", "Required Clover item or modifier is unavailable.");

  if (expectation.kind === "ITEM") {
    if (typeof snapshot.priceType !== "string") return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_PRICE_TYPE_MISSING", "Clover item omitted fixed-price semantics.");
    if (snapshot.priceType.toUpperCase() !== "FIXED") return result(CatalogMappingStatus.STALE, "PROVIDER_PRICE_TYPE_MISMATCH", "Clover item is not fixed-price.");
  }
  if (expectation.kind === "MODIFIER_OPTION") {
    const group = isRecord(snapshot.modifierGroup) ? snapshot.modifierGroup : null;
    if (!group || typeof group.id !== "string") return result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_MODIFIER_GROUP_MISSING", "Clover modifier omitted its modifier group.");
    if (!parentProviderId || group.id !== parentProviderId) return result(CatalogMappingStatus.STALE, "PROVIDER_MODIFIER_GROUP_MISMATCH", "Clover modifier belongs to a different modifier group.");
  }
  return result(CatalogMappingStatus.VERIFIED);
}

async function observeAndPersistMapping(
  client: PrismaClient,
  provider: CatalogProvider,
  configuration: { provider: string },
  local: RequiredEntity,
  providerId: string,
  semanticExpectation?: LogicalSemanticExpectation,
  audit?: (tx: Prisma.TransactionClient, mapping: { id: string; entityType: CatalogEntityType; localKey: string; providerId: string; status: CatalogMappingStatus }) => Promise<unknown>,
) {
  let snapshot: unknown = null;
  let evaluation: Evaluation;
  let parentProviderId: string | undefined;
  if (local.expectation.kind === "MODIFIER_OPTION") {
    const parent = await client.providerCatalogMapping.findUnique({
      where: { provider_entityType_localKey: { provider: configuration.provider, entityType: CatalogEntityType.MODIFIER_GROUP, localKey: local.expectation.parentLocalKey } },
    });
    if (!parent || parent.status !== CatalogMappingStatus.VERIFIED) {
      evaluation = result(CatalogMappingStatus.AMBIGUOUS, "PARENT_MAPPING_UNVERIFIED", "Verify the local modifier-group mapping before its modifier options.");
      return persist(client, configuration.provider, local, providerId, snapshot, evaluation, undefined, audit);
    }
    parentProviderId = parent.providerId;
  }
  try {
    snapshot = await provider.read(local.entityType, providerId, { parentProviderId });
    evaluation = evaluateCatalogSnapshot(providerId, local.expectation, snapshot, parentProviderId, semanticExpectation);
  } catch (error) {
    evaluation = error instanceof CloverApiError && error.status === 404
      ? result(CatalogMappingStatus.MISSING, "PROVIDER_ENTITY_NOT_FOUND", "Clover catalog object was not found.")
      : result(CatalogMappingStatus.AMBIGUOUS, "PROVIDER_READ_FAILED", error instanceof Error ? error.message : String(error));
  }
  return persist(client, configuration.provider, local, providerId, snapshot, evaluation, semanticExpectation, audit);
}

async function persist(client: PrismaClient, provider: string, local: RequiredEntity, providerId: string, snapshot: unknown, evaluation: Evaluation, semanticExpectation?: LogicalSemanticExpectation, audit?: (tx: Prisma.TransactionClient, mapping: { id: string; entityType: CatalogEntityType; localKey: string; providerId: string; status: CatalogMappingStatus }) => Promise<unknown>) {
  const now = new Date();
  const providerFingerprint = snapshot === null ? null : catalogFingerprint(snapshot);
  const providerSnapshot = snapshot === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
  const write = (database: Prisma.TransactionClient | PrismaClient) => database.providerCatalogMapping.upsert({
    where: { provider_entityType_localKey: { provider, entityType: local.entityType, localKey: local.localKey } },
    create: { provider, entityType: local.entityType, localKey: local.localKey, providerId, status: evaluation.status, localFingerprint: local.fingerprint, providerFingerprint, providerSnapshot, providerUpdatedAt: now, verifiedAt: evaluation.status === CatalogMappingStatus.VERIFIED ? now : null, issueCode: evaluation.issueCode, issueMessage: evaluation.issueMessage, semanticExpectation: semanticExpectation ? JSON.parse(JSON.stringify(semanticExpectation)) : undefined, semanticApprovedBy: semanticExpectation?.approvedBy, semanticApprovedAt: semanticExpectation ? now : null },
    update: { providerId, status: evaluation.status, localFingerprint: local.fingerprint, providerFingerprint, providerSnapshot, providerUpdatedAt: now, verifiedAt: evaluation.status === CatalogMappingStatus.VERIFIED ? now : null, issueCode: evaluation.issueCode, issueMessage: evaluation.issueMessage, ...(semanticExpectation ? { semanticExpectation: JSON.parse(JSON.stringify(semanticExpectation)), semanticApprovedBy: semanticExpectation.approvedBy, semanticApprovedAt: now } : {}) },
  });
  if (!audit) return write(client);
  return client.$transaction(async (tx) => {
    const mapping = await write(tx);
    await audit(tx, mapping);
    return mapping;
  });
}

export async function verifyCatalogMapping(
  client: PrismaClient,
  provider: CatalogProvider,
  input: { entityType: CatalogEntityType; localKey: string; providerId: string; semanticExpectation?: LogicalSemanticExpectation },
  audit?: (tx: Prisma.TransactionClient, mapping: { id: string; entityType: CatalogEntityType; localKey: string; providerId: string; status: CatalogMappingStatus }) => Promise<unknown>,
) {
  const { configuration, required } = await loadActiveRequiredCatalogEntities(client);
  const local = required.find((entity) => entity.entityType === input.entityType && entity.localKey === input.localKey);
  if (!local) throw new Error("Mapping target is not part of the active delivery catalog.");
  return observeAndPersistMapping(client, provider, configuration, local, input.providerId, input.semanticExpectation, audit);
}

export async function refreshCatalogMappings(client: PrismaClient, provider: CatalogProvider) {
  const startedAt = new Date();
  await client.catalogConfiguration.upsert({ where: { id: 1 }, create: { id: 1, lastSyncStartedAt: startedAt }, update: { lastSyncStartedAt: startedAt, lastSyncError: null } });
  try {
    const { configuration, required } = await loadActiveRequiredCatalogEntities(client);
    const mappings = await client.providerCatalogMapping.findMany({ where: { provider: configuration.provider } });
    const byKey = new Map(mappings.map((mapping) => [`${mapping.entityType}:${mapping.localKey}`, mapping]));
    const observations = [];
    for (const local of required) {
      const mapping = byKey.get(`${local.entityType}:${local.localKey}`);
      if (!mapping || mapping.providerId.startsWith("missing::")) {
        observations.push(await persist(client, configuration.provider, local, `missing::${local.entityType}::${local.localKey}`, null, result(CatalogMappingStatus.MISSING, "MAPPING_NOT_CONFIGURED", "Required Clover mapping has not been configured.")));
        continue;
      }
      const semanticExpectation = isRecord(mapping.semanticExpectation) ? mapping.semanticExpectation as LogicalSemanticExpectation : undefined;
      observations.push(await observeAndPersistMapping(client, provider, configuration, local, mapping.providerId, semanticExpectation));
    }
    const blockerCount = observations.filter((mapping) => mapping.status !== CatalogMappingStatus.VERIFIED).length;
    await client.catalogConfiguration.update({ where: { id: 1 }, data: { lastSyncCompletedAt: new Date(), lastSyncError: blockerCount ? `${blockerCount} mapped catalog object(s) require reconciliation.` : null } });
    return { observedCount: observations.length, blockerCount, observations };
  } catch (error) {
    await client.catalogConfiguration.update({ where: { id: 1 }, data: { lastSyncError: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
