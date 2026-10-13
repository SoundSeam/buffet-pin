import { OrderActorType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createDriverAccessToken,
  revokeActiveDriverAccessTokensInTransaction,
} from "@/lib/driver-access";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getStaffUser("STAFF_WRITE");
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid driver id.", parsedParams.error.issues);
  }

  try {
    const driver = await db.driver.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true },
    });

    if (!driver) {
      return errorResponse(404, "DRIVER_NOT_FOUND", "Driver not found.");
    }

    const accessToken = await db.$transaction(async (tx) => {
      await revokeActiveDriverAccessTokensInTransaction(tx, driver.id);
      const created = await createDriverAccessToken(driver.id, "Regenerated link", tx);
      await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.ADMIN, actorId: user.staff.id, actorLabel: user.staff.displayName, eventType: "DRIVER_ACCESS_REGENERATED", entityType: "Driver", entityId: driver.id, metadata: { accessTokenId: created.token.id } } });
      return created;
    });

    return NextResponse.json({
      ok: true,
      data: {
        accessUrl: accessToken.accessUrl,
        accessToken: {
          id: accessToken.token.id,
          label: accessToken.token.label,
          createdAt: accessToken.token.createdAt.toISOString(),
          lastUsedAt: accessToken.token.lastUsedAt?.toISOString() ?? null,
          expiresAt: accessToken.token.expiresAt?.toISOString() ?? null,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse(404, "DRIVER_NOT_FOUND", "Driver not found.");
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to regenerate driver link.");
  }
}
