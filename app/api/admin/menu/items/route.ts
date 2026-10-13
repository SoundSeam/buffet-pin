import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { menuItemCreateSchema } from "@/lib/orders/validation";
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
    const payload = menuItemCreateSchema.parse(await request.json());
    const item = await db.$transaction(async (tx) => {
      const created = await tx.menuItem.create({ data: payload });
      await recordCatalogMutation(tx, actor, "CATALOG_ITEM_CREATED", "MenuItem", created.id, { changedFields: Object.keys(payload) });
      return created;
    });

    return NextResponse.json({ ok: true, data: { item } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid menu item.", error.issues);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return errorResponse(400, "CATEGORY_NOT_FOUND", "Category not found.");
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to create menu item.");
  }
}
