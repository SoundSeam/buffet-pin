import { describe, expect, it, vi } from "vitest";
import { createCloverClient, type CloverClient } from "../../lib/clover/client";
import { CloverCatalogProvider } from "../../lib/providers/catalog";

const config = { env: "sandbox", checkoutMode: "iframe", merchantId: "merchant/id", publicAccessKey: null, privateToken: "ecommerce-token", platformToken: "platform-token", webhookSecret: null, apiBaseUrl: "https://apisandbox.dev.clover.com", ecommerceApiBaseUrl: "https://scl-sandbox.dev.clover.com" } as const;

describe("Clover catalog contract", () => {
  it("uses the nested modifier endpoint", async () => {
    const get = vi.fn().mockResolvedValue({ id: "modifier/id" });
    const provider = new CloverCatalogProvider({ config, get, post: vi.fn() } as unknown as CloverClient);
    await provider.read("MODIFIER_OPTION", "modifier/id", { parentProviderId: "group/id" });
    expect(get).toHaveBeenCalledWith("/v3/merchants/merchant%2Fid/modifier_groups/group%2Fid/modifiers/modifier%2Fid");
  });

  it("sends the required Buffet Pin user agent on platform reads", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "item-1" }), { status: 200, headers: { "content-type": "application/json" } }));
    await createCloverClient(config).get("/v3/merchants/merchant/items/item-1");
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ "User-Agent": "BuffetPinDirect/1.0" });
    fetcher.mockRestore();
  });
});
