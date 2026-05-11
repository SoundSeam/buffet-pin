import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import type { PrismaClient } from "@prisma/client";

type RateLimitDb = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

export type PublicRateLimitConfig = {
  scope: string;
  limit: number;
  windowMs: number;
};

type RateLimitRow = {
  hitCount: number;
  expiresAt: Date;
};

type RateLimitDecision =
  | {
      ok: true;
      limit: number;
      remaining: number;
      retryAfterSeconds: number;
    }
  | {
      ok: false;
      limit: number;
      remaining: 0;
      retryAfterSeconds: number;
    };

type PublicClientIdentity = {
  key: string;
  source: "ip" | "header-fingerprint";
};

export const PUBLIC_ENDPOINT_RATE_LIMITS = {
  availabilityClient: {
    scope: "public-availability-client",
    limit: 20,
    windowMs: 60_000,
  },
  reservationCreateClient: {
    scope: "public-reservation-create-client",
    limit: 4,
    windowMs: 15 * 60_000,
  },
  reservationCreatePhone: {
    scope: "public-reservation-create-phone",
    limit: 3,
    windowMs: 60 * 60_000,
  },
} satisfies Record<string, PublicRateLimitConfig>;

const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60_000;
const CLEANUP_INTERVAL_MS = 15 * 60_000;

const globalForRateLimitCleanup = globalThis as unknown as {
  publicRateLimitCleanupAt?: number;
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function extractForwardedForValue(forwardedHeader: string | null): string | null {
  if (!forwardedHeader) {
    return null;
  }

  for (const part of forwardedHeader.split(",")) {
    for (const token of part.split(";")) {
      const [key, rawValue] = token.split("=");

      if (key?.trim().toLowerCase() !== "for" || !rawValue) {
        continue;
      }

      return rawValue.trim();
    }
  }

  return null;
}

function normalizeIpCandidate(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  let value = candidate.trim();

  if (!value) {
    return null;
  }

  value = value.replace(/^for=/i, "").replace(/^"+|"+$/g, "");

  if (value.startsWith("[")) {
    const closingBracketIndex = value.indexOf("]");

    if (closingBracketIndex > 1) {
      value = value.slice(1, closingBracketIndex);
    }
  } else {
    const colonCount = value.split(":").length - 1;

    if (colonCount === 1) {
      const [host] = value.split(":");

      if (isIP(host) === 4) {
        value = host;
      }
    }
  }

  return isIP(value) ? value.toLowerCase() : null;
}

function getPublicClientIdentity(request: Request): PublicClientIdentity {
  const headers = request.headers;
  const forwardedIp = extractForwardedForValue(headers.get("forwarded"));
  const xForwardedFor = headers.get("x-forwarded-for")?.split(",")[0];
  const xVercelForwardedFor = headers.get("x-vercel-forwarded-for")?.split(",")[0];

  const ip =
    normalizeIpCandidate(headers.get("cf-connecting-ip")) ??
    normalizeIpCandidate(headers.get("x-real-ip")) ??
    normalizeIpCandidate(xVercelForwardedFor) ??
    normalizeIpCandidate(xForwardedFor) ??
    normalizeIpCandidate(forwardedIp);

  if (ip) {
    return { key: `ip:${ip}`, source: "ip" };
  }

  const url = new URL(request.url);
  const fingerprintParts = [
    headers.get("user-agent")?.trim().toLowerCase() || "unknown-ua",
    headers.get("accept-language")?.trim().toLowerCase() || "unknown-language",
    headers.get("sec-ch-ua-platform")?.trim().toLowerCase() || "unknown-platform",
    url.pathname,
  ];

  return {
    key: `header-fingerprint:${fingerprintParts.join("|")}`,
    source: "header-fingerprint",
  };
}

export function getPublicClientRateLimitKey(request: Request): string {
  const identity = getPublicClientIdentity(request);
  return identity.key;
}

export function getReservationPhoneRateLimitKey(phone: string): string {
  const normalized = phone.trim().replace(/[^\d+]/g, "");
  return `phone:${normalized || phone.trim()}`;
}

async function maybeCleanupExpiredRateLimits(db: RateLimitDb, now: Date) {
  const nextCleanupAt = globalForRateLimitCleanup.publicRateLimitCleanupAt ?? 0;

  if (nextCleanupAt > now.getTime()) {
    return;
  }

  globalForRateLimitCleanup.publicRateLimitCleanupAt =
    now.getTime() + CLEANUP_INTERVAL_MS;

  await db.$executeRaw`
    DELETE FROM "PublicApiRateLimit"
    WHERE "expiresAt" < ${new Date(now.getTime() - RATE_LIMIT_RETENTION_MS)}
  `;
}

export async function consumeRateLimit(
  db: RateLimitDb,
  config: PublicRateLimitConfig,
  identifier: string,
): Promise<RateLimitDecision> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.windowMs);
  const identifierHash = sha256(identifier);

  await maybeCleanupExpiredRateLimits(db, now);

  const [row] = await db.$queryRaw<RateLimitRow[]>`
    INSERT INTO "PublicApiRateLimit" (
      "scope",
      "identifierHash",
      "hitCount",
      "windowStartedAt",
      "expiresAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${config.scope},
      ${identifierHash},
      1,
      ${now},
      ${expiresAt},
      ${now},
      ${now}
    )
    ON CONFLICT ("scope", "identifierHash")
    DO UPDATE SET
      "hitCount" = CASE
        WHEN "PublicApiRateLimit"."expiresAt" <= ${now} THEN 1
        ELSE "PublicApiRateLimit"."hitCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "PublicApiRateLimit"."expiresAt" <= ${now} THEN ${now}
        ELSE "PublicApiRateLimit"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "PublicApiRateLimit"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "PublicApiRateLimit"."expiresAt"
      END,
      "updatedAt" = ${now}
    RETURNING "hitCount", "expiresAt"
  `;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000),
  );
  const remaining = Math.max(config.limit - row.hitCount, 0);

  if (row.hitCount > config.limit) {
    return {
      ok: false,
      limit: config.limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    ok: true,
    limit: config.limit,
    remaining,
    retryAfterSeconds,
  };
}

// When a real bot challenge is added later, verify it before calling the
// limiter or add a stricter scope that only applies after repeated failures.
