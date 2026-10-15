import { describe, expect, it } from "vitest";
import postcss, { type PluginCreator } from "postcss";
import { createRequire } from "node:module";
const compatibility = createRequire(import.meta.url)("../../tooling/postcss-v3-compat.cjs") as PluginCreator<Record<string, never>>;

describe("v3 visual cascade retained with the patched compiler", () => {
  it("responsive font sizes reset base leading while explicit leading remains intact", async () => {
    const css = (await postcss([compatibility]).process('.text-4xl{font-size:2.25rem;line-height:var(--tw-leading, 2.5rem)}.leading-tight{--tw-leading:1.25;line-height:var(--tw-leading)}', { from: undefined })).root;
    const values: string[] = []; css.walkDecls("line-height", d => { values.push(d.value); });
    expect(values).toEqual(["2.5rem", "var(--tw-leading)"]);
  });
  it("does not rewrite unrelated line heights or arbitrary expressions", async () => {
    const input = '.text-custom{font-size:1rem;line-height:22px}.leading{line-height:var(--tw-leading, 1.4)}';
    expect((await postcss([compatibility]).process(input, { from: undefined })).css).toBe(input);
  });
  it("retains sibling spacing after the first visible child and correct reversal edges", async () => {
    const output = (await postcss([compatibility]).process(':where(.space-y-4 > :not(:last-child)){--tw-space-y-reverse:0;margin-block-start:0px;margin-block-end:16px}', { from: undefined })).root;
    const rule = output.first! as postcss.Rule;
    expect(rule.selector).toBe('.space-y-4 > :not([hidden]) ~ :not([hidden])');
    const values: Record<string, string> = {}; rule.walkDecls(d => { values[d.prop] = d.value; });
    expect(values).toMatchObject({ "margin-top": "16px", "margin-bottom": "0px" });
  });
  it("keeps divider borders on the v3 physical edges", async () => {
    const result = await postcss([compatibility]).process(':where(.divide-x > :not(:last-child)){border-inline-start-width:0px;border-inline-end-width:1px}', { from: undefined });
    expect(result.css).toContain('border-right-width:0px'); expect(result.css).toContain('border-left-width:1px');
    expect(result.css).not.toContain(':last-child');
  });
});
