import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { modifierOptionUpdateSchema } from "@/lib/orders/validation";
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
    const payload = modifierOptionUpdateSchema.parse(await request.json());
    const modifierOption = await db.modifierOption.update({
      where: { id },
      data: payload,
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
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    const modifierOption = await db.modifierOption.update({
      where: { id },
      data: { isActive: false, isAvailable: false },
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
