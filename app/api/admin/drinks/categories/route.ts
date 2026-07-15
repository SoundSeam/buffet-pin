import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { drinkCategoryCreateSchema } from "@/lib/drinks/validation";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(request: Request) {
  const user = await getAdminUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  try {
    const payload = drinkCategoryCreateSchema.parse(await request.json());
    const category = await db.drinkCategory.create({ data: payload });

    return NextResponse.json({ ok: true, data: { category } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid drink category.", error.issues);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to create drink category.");
  }
}
