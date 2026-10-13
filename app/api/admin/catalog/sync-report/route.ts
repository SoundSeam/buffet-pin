import { NextResponse } from "next/server";
import { buildCatalogSyncReport } from "@/lib/orders/catalog";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";
import { CatalogEntityType, OrderActorType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  refreshCatalogMappings,
  verifyCatalogMapping,
} from "@/lib/orders/catalog-sync";
import { CloverCatalogProvider } from "@/lib/providers/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getStaffUserWithAnyCapability(["CATALOG_WRITE", "DEV_TOOLS"]))) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Admin access required." },
      },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, data: await buildCatalogSyncReport() });
}

const mappingSchema = z.object({
  entityType: z.nativeEnum(CatalogEntityType),
  localKey: z.string().min(1),
  providerId: z.string().min(1),
  expectedProviderName: z.string().trim().min(1).max(200).optional(),
  expectedProviderRate: z.string().trim().min(1).max(100).optional(),
  approvalReason: z.string().trim().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  const actor = await getStaffUserWithAnyCapability([
    "CATALOG_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = mappingSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const logicalTypes = new Set<CatalogEntityType>([
    CatalogEntityType.TAX_RATE,
    CatalogEntityType.ORDER_TYPE,
    CatalogEntityType.SERVICE_CHARGE,
  ]);
  const logical = logicalTypes.has(parsed.data.entityType);
  if (
    logical &&
    (!parsed.data.expectedProviderName ||
      !parsed.data.approvalReason ||
      (parsed.data.entityType === CatalogEntityType.TAX_RATE &&
        !parsed.data.expectedProviderRate))
  )
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SEMANTIC_ATTESTATION_REQUIRED",
          message:
            "Financial mappings require exact provider name, purpose, and tax rate where applicable.",
        },
      },
      { status: 400 },
    );
  const mapping = await verifyCatalogMapping(
    db,
    new CloverCatalogProvider(),
    {
      ...parsed.data,
      semanticExpectation: logical
        ? {
            expectedName: parsed.data.expectedProviderName!,
            expectedRate: parsed.data.expectedProviderRate,
            approvalReason: parsed.data.approvalReason!,
            approvedBy: actor.staff.id,
          }
        : undefined,
    },
    async (tx, observed) => {
      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: actor.staff.id,
          actorLabel: actor.staff.displayName,
          eventType: "CATALOG_MAPPING_OBSERVED",
          entityType: "ProviderCatalogMapping",
          entityId: observed.id,
          reason: parsed.data.approvalReason,
          metadata: {
            entityType: observed.entityType,
            localKey: observed.localKey,
            providerId: observed.providerId,
            status: observed.status,
          },
        },
      });
    },
  );
  return NextResponse.json({ ok: true, data: { mapping } });
}

export async function PUT() {
  const actor = await getStaffUserWithAnyCapability([
    "CATALOG_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const refresh = await refreshCatalogMappings(db, new CloverCatalogProvider());
  await db.operationalAuditEvent.create({
    data: {
      actorType: OrderActorType.ADMIN,
      actorId: actor.staff.id,
      actorLabel: actor.staff.displayName,
      eventType: "CATALOG_MAPPING_REFRESHED",
      entityType: "CatalogConfiguration",
      entityId: "1",
      reason: "Manager requested a fresh Clover catalog observation.",
      metadata: {
        observedCount: refresh.observedCount,
        blockerCount: refresh.blockerCount,
      },
    },
  });
  return NextResponse.json({
    ok: true,
    data: { refresh, report: await buildCatalogSyncReport() },
  });
}
