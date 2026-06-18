import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { menuCategoryUpdateSchema } from "@/lib/orders/validation";
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
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    const payload = menuCategoryUpdateSchema.parse(await request.json());
    const category = await db.menuCategory.update({ where: { id }, data: payload });

    return NextResponse.json({ ok: true, data: { category } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid category.", error.issues);
    }
    if (isNotFound(error)) {
      return errorResponse(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update category.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    const category = await db.menuCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true, data: { category } });
  } catch (error) {
    if (isNotFound(error)) {
      return errorResponse(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to deactivate category.");
  }
}
