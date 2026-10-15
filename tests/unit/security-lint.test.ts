import { afterAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import baseline from "../fixtures/security/lint-rules-before.json";

const require = createRequire(import.meta.url);
const next = require("../../tooling/eslint-next/dist/index.js").default;
const getRootDirs = require("../../tooling/eslint-next/dist/utils/get-root-dirs.js").getRootDirs as (ctx: { cwd: string; settings: { next?: { rootDir?: string | string[] } } }) => string[];
const root = mkdtempSync(path.join(tmpdir(), "buffet-lint-"));
for (const name of ["packages/one", "packages/two", "other"]) mkdirSync(path.join(root, name), { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("lint coverage preserved after removing vulnerable glob tooling", () => {
  it("preserves every resolved rule, option and severity for TS/TSX/JS/MJS", async () => {
    const lint = new ESLint();
    for (const [file, rules] of Object.entries(baseline)) {
      const config = await lint.calculateConfigForFile(path.resolve(file));
      expect(config.rules, file).toEqual(rules);
    }
  });
  it("discovers roots without braces/micromatch, including patterns, arrays and absent directories", () => {
    expect(getRootDirs({ cwd: root, settings: {} })).toEqual([root]);
    const pattern = path.join(root, "packages/*");
    expect(getRootDirs({ cwd: root, settings: { next: { rootDir: pattern } } }).sort()).toEqual([path.join(root, "packages/one"), path.join(root, "packages/two")]);
    expect(getRootDirs({ cwd: root, settings: { next: { rootDir: [path.join(root, "other"), path.join(root, "absent")] } } })).toEqual([path.join(root, "other")]);
  });
  it("retains actionable Next diagnostics and accepts their corrected forms", async () => {
    const lint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { "@next/next": next }, rules: next.configs["core-web-vitals"].rules }] });
    // Include the recommended rule set as well as the two stronger core-web-vitals rules.
    const full = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules } }] });
    const errors = (await full.lintText('import Script from "next/script"; export default function A(){return <><img src="/x.png" /><Script>{"alert(1)"}</Script><script src="/x.js" /></>}', { filePath: "fixture.jsx" }))[0].messages;
    expect(errors.map(e => e.ruleId)).toEqual(expect.arrayContaining(["@next/next/no-img-element", "@next/next/inline-script-id", "@next/next/no-sync-scripts"]));
    const valid = (await lint.lintText('export default function A(){return <p>Menu</p>}', { filePath: "fixture.jsx" }))[0];
    expect(valid.messages).toEqual([]);
  });
});
