import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { modifierGroupUpdateSchema } from "@/lib/orders/validation";
import { getStaffUser } from "@/lib/supabase/auth";
import { recordCatalogMutation } from "@/lib/orders/catalog-audit";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function isNotFound(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("CATALOG_WRITE");
  if (!actor) return errorResponse(401, "UNAUTHORIZED", "Admin access required.");

  const { id } = await params;

  try {
    const payload = modifierGroupUpdateSchema.parse(await request.json());
    const modifierGroup = await db.$transaction(async (tx) => {
      const updated = await tx.modifierGroup.update({
        where: { id },
        data: payload,
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_GROUP_UPDATED", "ModifierGroup", updated.id, { changedFields: Object.keys(payload) });
      return updated;
    });

    return NextResponse.json({ ok: true, data: { modifierGroup } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid modifier group.",
        error.issues,
      );
    }
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "MODIFIER_GROUP_NOT_FOUND",
        "Modifier group not found.",
      );
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update modifier group.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("CATALOG_WRITE");
  if (!actor) return errorResponse(401, "UNAUTHORIZED", "Admin access required.");

  const { id } = await params;

  try {
    const modifierGroup = await db.$transaction(async (tx) => {
      const updated = await tx.modifierGroup.update({
        where: { id },
        data: { isActive: false },
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_GROUP_DEACTIVATED", "ModifierGroup", updated.id);
      return updated;
    });

    return NextResponse.json({ ok: true, data: { modifierGroup } });
  } catch (error) {
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "MODIFIER_GROUP_NOT_FOUND",
        "Modifier group not found.",
      );
    }
    console.error(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to deactivate modifier group.",
    );
  }
}
