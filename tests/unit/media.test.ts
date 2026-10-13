import { describe, expect, it } from "vitest";

import { buffetPinMedia } from "@/lib/media";

describe("Buffet Pin media manifest", () => {
  it("uses only the dedicated CloudFront distribution", () => {
    const urls = Object.values(buffetPinMedia);

    expect(urls).toHaveLength(8);
    expect(new Set(urls).size).toBe(8);
    expect(urls.every((url) => url.startsWith("https://d2d93bgcpgtdom.cloudfront.net/misc/"))).toBe(true);
    expect(urls.every((url) => !url.includes("soundseam-origin"))).toBe(true);
  });
});
