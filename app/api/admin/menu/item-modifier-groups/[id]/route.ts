import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { itemModifierGroupUpdateSchema } from "@/lib/orders/validation";
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
    const payload = itemModifierGroupUpdateSchema.parse(await request.json());
    const assignment = await db.$transaction(async (tx) => {
      const updated = await tx.menuItemModifierGroup.update({
        where: { id },
        data: payload,
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_ASSIGNMENT_UPDATED", "MenuItemModifierGroup", updated.id, { changedFields: Object.keys(payload) });
      return updated;
    });

    return NextResponse.json({ ok: true, data: { assignment } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid modifier group assignment.",
        error.issues,
      );
    }
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "ASSIGNMENT_NOT_FOUND",
        "Modifier group assignment not found.",
      );
    }
    console.error(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to update modifier group assignment.",
    );
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
    await db.$transaction(async (tx) => {
      const deleted = await tx.menuItemModifierGroup.delete({ where: { id } });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_GROUP_UNASSIGNED", "MenuItemModifierGroup", deleted.id, { menuItemId: deleted.menuItemId, modifierGroupId: deleted.modifierGroupId });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "ASSIGNMENT_NOT_FOUND",
        "Modifier group assignment not found.",
      );
    }
    console.error(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to remove modifier group assignment.",
    );
  }
}
