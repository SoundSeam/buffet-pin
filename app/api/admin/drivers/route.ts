import { OrderActorType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createDriverAccessToken } from "@/lib/driver-access";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";
import { roleHasCapability } from "@/lib/staff-policy";

export const dynamic = "force-dynamic";

const driverSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  isActive: z.boolean().default(true),
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

function serializeDriver(
  driver: Prisma.DriverGetPayload<{ select: typeof driverSelect }>,
) {
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

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function prismaErrorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return errorResponse(
      409,
      "DUPLICATE_DRIVER",
      "A driver already uses that email.",
    );
  }

  console.error(error);
  return errorResponse(500, "INTERNAL_ERROR", "Unable to save driver.");
}

export async function GET() {
  const user = await getStaffUserWithAnyCapability([
    "STAFF_WRITE",
    "DISPATCH_WRITE",
  ]);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const drivers = await db.driver.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: driverSelect,
  });

  return NextResponse.json({
    ok: true,
    data: {
      drivers: drivers.map((driver) => {
        const serialized = serializeDriver(driver);
        return roleHasCapability(user.staff.role, "STAFF_WRITE")
          ? serialized
          : { ...serialized, email: null, accessTokens: [] };
      }),
    },
  });
}

export async function POST(request: Request) {
  const user = await getStaffUser("STAFF_WRITE");
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  let payload: z.infer<typeof driverSchema>;

  try {
    payload = driverSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid driver.",
        error.issues,
      );
    }
    return errorResponse(400, "INVALID_JSON", "Invalid driver.");
  }

  try {
    const { driver, accessToken } = await db.$transaction(async (tx) => {
      const created = await tx.driver.create({
        data: {
          name: payload.name,
          phone: normalizeOptionalString(payload.phone),
          email: normalizeOptionalString(payload.email),
          isActive: payload.isActive,
        },
        select: { id: true },
      });
      const token = await createDriverAccessToken(
        created.id,
        "Initial link",
        tx,
      );
      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: user.staff.id,
          actorLabel: user.staff.displayName,
          eventType: "DRIVER_CREATED_WITH_ACCESS",
          entityType: "Driver",
          entityId: created.id,
          metadata: {
            isActive: payload.isActive,
            accessTokenId: token.token.id,
          },
        },
      });
      return { driver: created, accessToken: token };
    });
    const driverWithToken = await db.driver.findUniqueOrThrow({
      where: { id: driver.id },
      select: driverSelect,
    });

    return NextResponse.json({
      ok: true,
      data: {
        driver: serializeDriver(driverWithToken),
        accessUrl: accessToken.accessUrl,
      },
    });
  } catch (error) {
    return prismaErrorResponse(error);
  }
}
