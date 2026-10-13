import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { itemModifierGroupCreateSchema } from "@/lib/orders/validation";
import { getStaffUser } from "@/lib/supabase/auth";
import { recordCatalogMutation } from "@/lib/orders/catalog-audit";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(request: Request) {
  const actor = await getStaffUser("CATALOG_WRITE");
  if (!actor) return errorResponse(401, "UNAUTHORIZED", "Admin access required.");

  try {
    const payload = itemModifierGroupCreateSchema.parse(await request.json());
    const assignment = await db.$transaction(async (tx) => {
      const updated = await tx.menuItemModifierGroup.upsert({
        where: {
          menuItemId_modifierGroupId: {
            menuItemId: payload.menuItemId,
            modifierGroupId: payload.modifierGroupId,
          },
        },
        update: { sortOrder: payload.sortOrder },
        create: payload,
      });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_GROUP_ASSIGNED", "MenuItemModifierGroup", updated.id, { menuItemId: updated.menuItemId, modifierGroupId: updated.modifierGroupId, sortOrder: updated.sortOrder });
      return updated;
    });

    return NextResponse.json({ ok: true, data: { assignment } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid modifier group assignment.",
        error.issues,
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse(
        400,
        "ASSIGNMENT_TARGET_NOT_FOUND",
        "Menu item or modifier group not found.",
      );
    }
    console.error(error);
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to assign modifier group.",
    );
  }
}
