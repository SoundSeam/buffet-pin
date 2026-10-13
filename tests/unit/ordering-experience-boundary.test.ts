import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260813170000_ordering_experience_rework/migration.sql",
  "utf8",
);

describe("ordering-experience protected boundary", () => {
  it("does not mutate reservation tables, types, indexes, or triggers", () => {
    expect(migration).not.toMatch(/(?:ALTER|DROP|TRUNCATE|DELETE\s+FROM)\s+(?:TABLE\s+)?"?(?:Reservation|Settings|SlotCapacitySetting|ClosureDate)"?/i);
    expect(migration).not.toMatch(/DROP\s+(?:TYPE|TRIGGER|FUNCTION).*reservation/i);
  });

  it("contains no broad destructive order-data operation", () => {
    expect(migration).not.toMatch(/TRUNCATE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
