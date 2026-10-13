import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const databaseUrl = assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

afterAll(async () => {
  await prisma.$disconnect();
});

describe("isolated database migrations", () => {
  it("applies the complete migration history to a disposable database", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('Order', 'Payment', 'Driver')
      ORDER BY table_name
    `;

    expect(rows.map((row) => row.table_name)).toEqual(["Driver", "Order", "Payment"]);
  });
});
