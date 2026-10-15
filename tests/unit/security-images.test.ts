import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createRequire } from "node:module";
const QRCode = createRequire(import.meta.url)("qrcode") as { toString: (text: string, options: { type: "svg"; margin: number; width: number }) => Promise<string> };
import jsQR from "jsqr";

const atLeast = (actual: string | undefined, minimum: string) => {
  expect(actual).toBeDefined();
  const a = actual!.split(".").map(Number), b = minimum.split(".").map(Number);
  for (let i = 0; i < b.length; i++) { if (a[i] !== b[i]) { expect(a[i]).toBeGreaterThan(b[i]); return; } }
};

describe("patched native image processing", () => {
  it("loads patched bundled libheif and librsvg versions", () => {
    atLeast(sharp.versions.heif, "1.23.2"); atLeast(sharp.versions.rsvg, "2.63.2");
  });
  it.each(["png", "jpeg", "webp", "avif"] as const)("round-trips %s without touching assets", async format => {
    const input = sharp({ create: { width: 8, height: 8, channels: 3, background: "#062f24" } });
    const encoded = await input.toFormat(format).toBuffer();
    const decoded = await sharp(encoded).raw().toBuffer({ resolveWithObject: true });
    expect(decoded.info).toMatchObject({ width: 8, height: 8, channels: 3 });
  });
  it("keeps SVG-backed drinks QR generation readable", async () => {
    const text = "https://www.buffetpin.com/drinks";
    const svg = await QRCode.toString(text, { type: "svg", margin: 4, width: 320 });
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(text);
  });
  it("rejects malformed input visibly", async () => expect(sharp(Buffer.from("invalid image")).toBuffer()).rejects.toThrow());
});
