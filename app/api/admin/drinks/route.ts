import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  const user = await getAdminUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const [categories, items] = await Promise.all([
    db.drinkCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    }),
    db.drinkItem.findMany({
      orderBy: [
        { category: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { nameEn: "asc" },
      ],
    }),
  ]);

  return NextResponse.json({ ok: true, data: { categories, items } });
}
