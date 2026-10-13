import type { CatalogEntityType } from "@prisma/client";
import { createCloverClient, type CloverClient } from "@/lib/clover/client";

export interface CatalogProvider {
  read(entityType: CatalogEntityType, providerId: string, context?: { parentProviderId?: string }): Promise<unknown>;
}

const paths: Record<CatalogEntityType, string> = {
  CATEGORY: "categories",
  ITEM: "items",
  MODIFIER_GROUP: "modifier_groups",
  MODIFIER_OPTION: "modifiers",
  TAX_RATE: "tax_rates",
  ORDER_TYPE: "order_types",
  SERVICE_CHARGE: "default_service_charge",
};

export class CloverCatalogProvider implements CatalogProvider {
  constructor(private readonly client: CloverClient = createCloverClient()) {}
  read(entityType: CatalogEntityType, providerId: string, context?: { parentProviderId?: string }) {
    if (entityType === "MODIFIER_OPTION") {
      if (!context?.parentProviderId) throw new Error("Modifier reads require a verified Clover modifier-group id.");
      return this.client.get(`/v3/merchants/${encodeURIComponent(this.client.config.merchantId)}/modifier_groups/${encodeURIComponent(context.parentProviderId)}/modifiers/${encodeURIComponent(providerId)}`);
    }
    if (entityType === "SERVICE_CHARGE") {
      return this.client.get(`/v3/merchants/${encodeURIComponent(this.client.config.merchantId)}/default_service_charge`);
    }
    if (entityType === "ITEM") {
      return this.client.get(
        `/v3/merchants/${encodeURIComponent(this.client.config.merchantId)}/items/${encodeURIComponent(providerId)}?expand=taxRates`,
      );
    }
    return this.client.get(
      `/v3/merchants/${encodeURIComponent(this.client.config.merchantId)}/${paths[entityType]}/${encodeURIComponent(providerId)}`,
    );
  }
}

export class FakeCatalogProvider implements CatalogProvider {
  constructor(private readonly records: Map<string, unknown>) {}
  async read(entityType: CatalogEntityType, providerId: string) {
    const key = `${entityType}:${providerId}`;
    if (!this.records.has(key)) throw new Error(`Fake catalog entity missing: ${key}`);
    return this.records.get(key);
  }
}
