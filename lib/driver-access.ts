import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { Driver, Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { getAppUrl, getDriverSessionSecret } from "@/lib/env";

const DRIVER_SESSION_COOKIE = "buffet_pin_driver_session";
const DRIVER_API_SESSION_COOKIE = "buffet_pin_driver_api_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type DriverSessionPayload = {
  driverId: string;
  sessionVersion: number;
  issuedAt: number;
};

export type DriverSession = {
  driver: Driver;
};

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", getDriverSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createSessionValue(driverId: string, sessionVersion: number) {
  const payload: DriverSessionPayload = {
    driverId,
    sessionVersion,
    issuedAt: Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseSessionValue(value: string): DriverSessionPayload | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!timingSafeEqual(signature, signPayload(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<DriverSessionPayload>;

    if (
      typeof payload.driverId !== "string" ||
      payload.driverId.length === 0 ||
      typeof payload.sessionVersion !== "number" ||
      typeof payload.issuedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
      return null;
    }

    return {
      driverId: payload.driverId,
      sessionVersion: payload.sessionVersion,
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

export function createDriverAccessUrl(rawToken: string) {
  return new URL(`/driver/access/${rawToken}`, getAppUrl()).toString();
}

export async function createDriverAccessToken(
  driverId: string,
  label?: string,
  client: PrismaClient | Prisma.TransactionClient = db,
) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const token = await client.driverAccessToken.create({
    data: {
      driverId,
      tokenHash: hashToken(rawToken),
      label,
    },
  });

  return {
    rawToken,
    accessUrl: createDriverAccessUrl(rawToken),
    token,
  };
}

export async function revokeActiveDriverAccessTokens(driverId: string) {
  await db.$transaction(async (tx) => {
    await revokeActiveDriverAccessTokensInTransaction(tx, driverId);
  });
}

export async function revokeActiveDriverAccessTokensInTransaction(
  tx: Prisma.TransactionClient,
  driverId: string,
) {
  await tx.driverAccessToken.updateMany({ where: { driverId, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.driver.update({ where: { id: driverId }, data: { sessionVersion: { increment: 1 } } });
}

export async function verifyDriverAccessToken(rawToken: string) {
  const now = new Date();
  const token = await db.driverAccessToken.findFirst({
    where: {
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      driver: true,
    },
  });

  if (!token || !token.driver.isActive) {
    return null;
  }

  await db.driverAccessToken.update({
    where: { id: token.id },
    data: { lastUsedAt: now },
  });

  return token.driver;
}

export async function setDriverSessionCookie(driverId: string) {
  const cookieStore = await cookies();
  const driver = await db.driver.findUniqueOrThrow({ where: { id: driverId }, select: { sessionVersion: true } });
  const value = createSessionValue(driverId, driver.sessionVersion);
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };

  cookieStore.set(DRIVER_SESSION_COOKIE, value, {
    ...options,
    path: "/driver",
  });
  cookieStore.set(DRIVER_API_SESSION_COOKIE, value, {
    ...options,
    path: "/api/driver",
  });
}

export async function clearDriverSessionCookie() {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };

  cookieStore.set(DRIVER_SESSION_COOKIE, "", {
    ...options,
    path: "/driver",
  });
  cookieStore.set(DRIVER_API_SESSION_COOKIE, "", {
    ...options,
    path: "/api/driver",
  });
}

export async function getDriverSession(): Promise<DriverSession | null> {
  const cookieStore = await cookies();
  const cookie =
    cookieStore.get(DRIVER_SESSION_COOKIE) ?? cookieStore.get(DRIVER_API_SESSION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  const payload = parseSessionValue(cookie.value);
  if (!payload) {
    return null;
  }

  const driver = await db.driver.findFirst({
    where: {
      id: payload.driverId,
      isActive: true,
      sessionVersion: payload.sessionVersion,
    },
  });

  return driver ? { driver } : null;
}
