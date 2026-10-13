import { OrderActorType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const updateDriverSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  isActive: z.boolean().optional(),
});

const driverSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  accessTokens: {
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.DriverSelect;

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function serializeDriver(driver: Prisma.DriverGetPayload<{ select: typeof driverSelect }>) {
  return {
    ...driver,
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
    accessTokens: driver.accessTokens.map((token) => ({
      ...token,
      createdAt: token.createdAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
    })),
  };
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function prismaErrorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return errorResponse(409, "DUPLICATE_DRIVER", "A driver already uses that email.");
    }
    if (error.code === "P2025") {
      return errorResponse(404, "DRIVER_NOT_FOUND", "Driver not found.");
    }
  }

  console.error(error);
  return errorResponse(500, "INTERNAL_ERROR", "Unable to save driver.");
}

export async function PATCH(
  request: Request,
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

  let payload: z.infer<typeof updateDriverSchema>;

  try {
    payload = updateDriverSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid driver.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid driver.");
  }

  try {
    const driver = await db.$transaction(async (tx) => {
      const updated = await tx.driver.update({
        where: { id: parsedParams.data.id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.phone !== undefined ? { phone: normalizeOptionalString(payload.phone) } : {}),
          ...(payload.email !== undefined ? { email: normalizeOptionalString(payload.email) } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        },
        select: driverSelect,
      });
      await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.ADMIN, actorId: user.staff.id, actorLabel: user.staff.displayName, eventType: "DRIVER_UPDATED", entityType: "Driver", entityId: updated.id, metadata: { changedFields: Object.keys(payload) } } });
      return updated;
    });

    return NextResponse.json({ ok: true, data: { driver: serializeDriver(driver) } });
  } catch (error) {
    return prismaErrorResponse(error);
  }
}
