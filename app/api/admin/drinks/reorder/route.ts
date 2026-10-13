import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const reorderSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("categories"),
    ids: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("drinks"),
    categoryId: z.string().min(1),
    ids: z.array(z.string().min(1)).min(1),
  }),
]);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Admin access required.");

  try {
    const payload = reorderSchema.parse(await request.json());
    const uniqueIds = new Set(payload.ids);
    if (uniqueIds.size !== payload.ids.length) {
      return errorResponse(400, "INVALID_ORDER", "Menu order contains duplicate items.");
    }

    if (payload.type === "categories") {
      const [matchedCount, totalCount] = await Promise.all([
        db.drinkCategory.count({ where: { id: { in: payload.ids } } }),
        db.drinkCategory.count(),
      ]);
      if (matchedCount !== payload.ids.length || totalCount !== payload.ids.length) {
        return errorResponse(409, "STALE_ORDER", "The category list changed. Reload and try again.");
      }
      await db.$transaction(
        payload.ids.map((id, index) =>
          db.drinkCategory.update({ where: { id }, data: { sortOrder: index * 10 } }),
        ),
      );
    } else {
      const [matchedCount, totalCount] = await Promise.all([
        db.drinkItem.count({
          where: { id: { in: payload.ids }, categoryId: payload.categoryId },
        }),
        db.drinkItem.count({ where: { categoryId: payload.categoryId } }),
      ]);
      if (matchedCount !== payload.ids.length || totalCount !== payload.ids.length) {
        return errorResponse(409, "STALE_ORDER", "This category changed. Reload and try again.");
      }
      await db.$transaction(
        payload.ids.map((id, index) =>
          db.drinkItem.update({ where: { id }, data: { sortOrder: index * 10 } }),
        ),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "INVALID_ORDER", "Invalid menu order.");
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update menu order.");
  }
}
