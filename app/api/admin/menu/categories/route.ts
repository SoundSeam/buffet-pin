import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { menuCategoryCreateSchema } from "@/lib/orders/validation";
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
    const payload = menuCategoryCreateSchema.parse(await request.json());
    const category = await db.menuCategory.create({ data: payload });

    return NextResponse.json({ ok: true, data: { category } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid category.", error.issues);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(409, "CATEGORY_CONFLICT", "Category already exists.");
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to create category.");
  }
}
