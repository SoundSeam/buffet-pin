import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { modifierOptionCreateSchema } from "@/lib/orders/validation";
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
    const payload = modifierOptionCreateSchema.parse(await request.json());
    const modifierOption = await db.$transaction(async (tx) => {
      const created = await tx.modifierOption.create({ data: payload });
      await recordCatalogMutation(tx, actor, "CATALOG_MODIFIER_OPTION_CREATED", "ModifierOption", created.id, { changedFields: Object.keys(payload) });
      return created;
    });

    return NextResponse.json(
      { ok: true, data: { modifierOption } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid modifier option.",
        error.issues,
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
    return errorResponse(500, "INTERNAL_ERROR", "Unable to create modifier option.");
  }
}
