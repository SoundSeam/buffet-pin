import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DrinkConflict, snapshot, updateDrink } from "@/lib/drinks/mutations";
import { db } from "@/lib/db";
import { drinkItemUpdateSchema } from "@/lib/drinks/validation";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const { id } = await params;

  try {
    const payload = drinkItemUpdateSchema.parse(await request.json());
    const item = await db.$transaction((tx) => updateDrink(tx, id, payload, user.id));

    return NextResponse.json({ ok: true, data: { item } });
  } catch (error) {
    if (error instanceof DrinkConflict) return errorResponse(409, "EDIT_CONFLICT", error.message);
    if (error instanceof SyntaxError) return errorResponse(400, "INVALID_JSON", "Invalid request body.");
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid drink.", error.issues);
    }
    if (isNotFound(error)) {
      return errorResponse(404, "DRINK_NOT_FOUND", "Drink not found.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return errorResponse(400, "CATEGORY_NOT_FOUND", "Drink category not found.");
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update drink.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const { id } = await params;

  try {
    const item = await db.$transaction(async (tx) => {
      const deleted = await tx.drinkItem.delete({ where: { id } });
      await tx.drinkMenuEvent.create({ data: { actorId: user.id, action: "item.delete", entityId: id, before: snapshot(deleted) } });
      return deleted;
    });

    return NextResponse.json({ ok: true, data: { item } });
  } catch (error) {
    if (isNotFound(error)) {
      return errorResponse(404, "DRINK_NOT_FOUND", "Drink not found.");
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to delete drink.");
  }
}
