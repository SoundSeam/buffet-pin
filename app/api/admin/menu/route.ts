import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}

async function requireAdminResponse() {
  const user = await getAdminUser();
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const [categories, items, modifierGroups, itemModifierGroups] =
    await Promise.all([
      db.menuCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.menuItem.findMany({
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      }),
      db.modifierGroup.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          options: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
      }),
      db.menuItemModifierGroup.findMany({
        orderBy: [{ menuItem: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      }),
    ]);

  return NextResponse.json({
    ok: true,
    data: {
      categories,
      items,
      modifierGroups,
      itemModifierGroups,
    },
  });
}
