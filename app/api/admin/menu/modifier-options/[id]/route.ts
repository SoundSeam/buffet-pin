import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { modifierOptionUpdateSchema } from "@/lib/orders/validation";
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
    const payload = modifierOptionUpdateSchema.parse(await request.json());
    const modifierOption = await db.$transaction(async (tx) => {
      const updated = await tx.modifierOption.update({
        where: { id },
        data: payload,
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_OPTION_UPDATED", "ModifierOption", updated.id, { changedFields: Object.keys(payload) });
      return updated;
    });

    return NextResponse.json({ ok: true, data: { modifierOption } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid modifier option.",
        error.issues,
      );
    }
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "MODIFIER_OPTION_NOT_FOUND",
        "Modifier option not found.",
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse(
        400,
        "MODIFIER_GROUP_NOT_FOUND",
        "Modifier group not found.",
      );
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update modifier option.");
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
    const modifierOption = await db.$transaction(async (tx) => {
      const updated = await tx.modifierOption.update({
        where: { id },
        data: { isActive: false, isAvailable: false },
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_OPTION_DEACTIVATED", "ModifierOption", updated.id);
      return updated;
    });

    return NextResponse.json({ ok: true, data: { modifierOption } });
  } catch (error) {
    if (isNotFound(error)) {
      return errorResponse(
        404,
        "MODIFIER_OPTION_NOT_FOUND",
        "Modifier option not found.",
      );
    }
    console.error(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to deactivate modifier option.",
    );
  }
}
