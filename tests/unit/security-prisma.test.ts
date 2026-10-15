import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { loadConfigFromFile } from "@prisma/config";

const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve("@prisma/config"));
const merge = configRequire("deepmerge-ts") as { deepmerge: (...values: unknown[]) => unknown };
const dirs: string[] = [];
const directory = () => { const dir = mkdtempSync(path.join(tmpdir(), "buffet-prisma-config-")); dirs.push(dir); return realpathSync(dir); };
afterAll(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));

describe("scoped patched merge compatibility with Prisma 6 config loading", () => {
  it("loads absent configuration without a remote/database operation", async () => {
    const result = await loadConfigFromFile({ configRoot: directory() });
    expect(result.error).toBeUndefined(); expect(result.resolvedPath).toBeNull();
  });
  it("loads a plain config and preserves migration/seed/schema/datasource values", async () => {
    const dir = directory();
    writeFileSync(path.join(dir, "prisma.config.mjs"), 'export default { schema: "schema.prisma", migrations: { path: "migrations", seed: "node seed.js" }, engine: "classic", datasource: { url: "postgresql://test:test@127.0.0.1:55439/disposable" } };');
    const result = await loadConfigFromFile({ configRoot: dir });
    expect(result.error).toBeUndefined();
    expect(result.config).toMatchObject({ schema: path.join(dir, "schema.prisma"), migrations: { path: path.join(dir, "migrations"), seed: "node seed.js" }, engine: "classic", datasource: { url: "postgresql://test:test@127.0.0.1:55439/disposable" } });
  });
  it("returns visible config errors rather than ignoring invalid input", async () => {
    const dir = directory(); writeFileSync(path.join(dir, "prisma.config.mjs"), 'throw new Error("fixture invalid config");');
    expect((await loadConfigFromFile({ configRoot: dir })).error).toBeDefined();
  });
  it("preserves the plain-record/array merge contract used by configuration", () => {
    expect(merge.deepmerge({ one: { a: 1 }, list: [1] }, { one: { b: 2 }, list: [2] })).toEqual({ one: { a: 1, b: 2 }, list: [1, 2] });
  });
  it("handles the advisory's recursive graph without stack exhaustion", () => {
    const left: { self?: unknown } = {}; const right: { self?: unknown } = {}; left.self = left; right.self = right;
    expect(() => merge.deepmerge(left, right)).not.toThrow();
  });
});
