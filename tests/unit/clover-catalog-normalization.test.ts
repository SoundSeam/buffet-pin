import { CatalogMappingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluateCatalogSnapshot } from "../../lib/orders/catalog-sync";

const item = { kind: "ITEM", name: "General Tao", priceCents: 1899, active: true, available: true } as const;
const modifier = { kind: "MODIFIER_OPTION", name: "Extra sauce", priceCents: 150, active: true, available: true, parentLocalKey: "group-local" } as const;

describe("Clover catalog snapshot normalization", () => {
  it("verifies matching fixed-price items and grouped modifiers", () => {
    expect(evaluateCatalogSnapshot("item-1", item, { id: "item-1", name: "General Tao", price: 1899, priceType: "FIXED", available: true, hidden: false, deleted: false }).status).toBe(CatalogMappingStatus.VERIFIED);
    expect(evaluateCatalogSnapshot("mod-1", modifier, { id: "mod-1", name: "Extra sauce", price: 150, available: true, deleted: false, modifierGroup: { id: "group-1" } }, "group-1").status).toBe(CatalogMappingStatus.VERIFIED);
  });

  it.each([
    [{ name: "General Tao", price: 1899, priceType: "FIXED", available: true }, "PROVIDER_ID_MISSING"],
    [{ id: "wrong", name: "General Tao", price: 1899, priceType: "FIXED", available: true }, "PROVIDER_ID_MISMATCH"],
    [{ id: "item-1", name: "General Tao", price: 1900, priceType: "FIXED", available: true }, "PROVIDER_PRICE_MISMATCH"],
    [{ id: "item-1", name: "General Tao", price: 1899, available: true }, "PROVIDER_PRICE_TYPE_MISSING"],
    [{ id: "item-1", name: "General Tao", price: 1899, priceType: "FIXED" }, "PROVIDER_AVAILABILITY_MISSING"],
    [{ id: "item-1", name: "General Tao", price: 1899, priceType: "FIXED", available: false }, "PROVIDER_ENTITY_SOLD_OUT"],
    [{ id: "item-1", name: "General Tao", price: 1899, priceType: "FIXED", available: true, hidden: true }, "PROVIDER_ENTITY_DISABLED"],
    [{ id: "item-1", name: "General Tao", price: 1899, priceType: "FIXED", available: "yes" }, "PROVIDER_STATE_MALFORMED"],
  ])("fails closed for malformed or mismatched item snapshot %#", (snapshot, issueCode) => {
    const evaluated = evaluateCatalogSnapshot("item-1", item, snapshot);
    expect(evaluated.status).not.toBe(CatalogMappingStatus.VERIFIED);
    expect(evaluated.issueCode).toBe(issueCode);
  });

  it("rejects a modifier attached to the wrong Clover group", () => {
    expect(evaluateCatalogSnapshot("mod-1", modifier, { id: "mod-1", name: "Extra sauce", price: 150, available: true, modifierGroup: { id: "wrong" } }, "group-1")).toMatchObject({ status: CatalogMappingStatus.STALE, issueCode: "PROVIDER_MODIFIER_GROUP_MISMATCH" });
  });

  it("requires manager-attested financial semantics and exact tax rate", () => {
    const tax = { kind: "LOGICAL", logicalKey: "quebec-combined", financialKind: "TAX_RATE", active: true } as const;
    const snapshot = { id: "tax-1", name: "Québec GST/QST", rate: "14975" };
    expect(evaluateCatalogSnapshot("tax-1", tax, snapshot)).toMatchObject({ status: CatalogMappingStatus.AMBIGUOUS, issueCode: "LOGICAL_ATTESTATION_REQUIRED" });
    const attestation = { expectedName: "Québec GST/QST", expectedRate: "14975", approvalReason: "Merchant-confirmed combined tax mapping", approvedBy: "manager-1" };
    expect(evaluateCatalogSnapshot("tax-1", tax, snapshot, undefined, attestation).status).toBe(CatalogMappingStatus.VERIFIED);
    expect(evaluateCatalogSnapshot("tax-1", tax, { ...snapshot, rate: "5000" }, undefined, attestation)).toMatchObject({ status: CatalogMappingStatus.STALE, issueCode: "PROVIDER_TAX_RATE_MISMATCH" });
  });
});
