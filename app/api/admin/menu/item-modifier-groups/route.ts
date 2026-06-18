import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { itemModifierGroupCreateSchema } from "@/lib/orders/validation";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

async function requireAdminResponse() {
  const user = await getAdminUser();
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  try {
    const payload = itemModifierGroupCreateSchema.parse(await request.json());
    const assignment = await db.menuItemModifierGroup.upsert({
      where: {
        menuItemId_modifierGroupId: {
          menuItemId: payload.menuItemId,
          modifierGroupId: payload.modifierGroupId,
        },
      },
      update: { sortOrder: payload.sortOrder },
      create: payload,
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
