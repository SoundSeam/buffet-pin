import { OrderServiceType, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { type DeliverySnapshot, validateDelivery } from "@/lib/orders/delivery";
import {
  CAD_CURRENCY_CODE,
  calculateQuebecTaxCents,
  calculatePpmAmountCents,
} from "@/lib/orders/money";
import {
  type PriceCartInput,
  priceCartSchema,
} from "@/lib/orders/validation";

type PricingDbClient = Prisma.TransactionClient | typeof db;

export class OrderPricingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OrderPricingError";
  }
}

export type PricedOrderItemModifierSnapshot = {
  modifierGroupId: string;
  modifierOptionId: string;
  modifierGroupNameSnapshot: string;
  modifierOptionNameSnapshot: string;
  priceDeltaCents: number;
  quantity: number;
};

export type PricedOrderItemSnapshot = {
  menuItemId: string;
  menuItemNameSnapshot: string;
  menuItemDescriptionSnapshot: string | null;
  quantity: number;
  unitPriceCents: number;
  modifiersTotalCents: number;
  lineSubtotalCents: number;
  specialInstructions: string | null;
  sortOrder: number;
  modifiers: PricedOrderItemModifierSnapshot[];
};

export type PricedCart = {
  serviceType: OrderServiceType;
  currency: string;
  itemsSubtotalCents: number;
  taxableSubtotalCents: number;
  gstCents: number;
  qstCents: number;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  delivery: DeliverySnapshot | null;
  items: PricedOrderItemSnapshot[];
};

const menuItemInclude = {
  category: true,
  modifierGroups: {
    include: {
      modifierGroup: {
        include: {
          options: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.MenuItemInclude;

type MenuItemWithPricingRelations = Prisma.MenuItemGetPayload<{
  include: typeof menuItemInclude;
}>;

async function getOrderSettings(client: PricingDbClient) {
  return client.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

function ensureUniqueModifierOptions(optionIds: string[], itemIndex: number) {
  const seen = new Set<string>();

  for (const optionId of optionIds) {
    if (seen.has(optionId)) {
      throw new OrderPricingError(
        "DUPLICATE_MODIFIER_OPTION",
        "Modifier options cannot be selected more than once for the same item.",
        { itemIndex, modifierOptionId: optionId },
      );
    }

    seen.add(optionId);
  }
}

function validateItemAvailability(item: MenuItemWithPricingRelations, itemIndex: number) {
  if (!item.isActive || !item.isAvailable || !item.category.isActive) {
    throw new OrderPricingError("ITEM_UNAVAILABLE", "Menu item is unavailable.", {
      itemIndex,
      menuItemId: item.id,
    });
  }
}

function validateServiceType(
  serviceType: OrderServiceType,
  settings: Awaited<ReturnType<typeof getOrderSettings>>,
) {
  if (!settings.onlineOrderingEnabled) {
    throw new OrderPricingError(
      "ONLINE_ORDERING_DISABLED",
      "Online ordering is currently unavailable.",
    );
  }

  if (serviceType === OrderServiceType.PICKUP && !settings.pickupEnabled) {
    throw new OrderPricingError("PICKUP_DISABLED", "Pickup ordering is unavailable.");
  }

  if (serviceType === OrderServiceType.DELIVERY && !settings.deliveryEnabled) {
    throw new OrderPricingError(
      "DELIVERY_DISABLED",
      "Delivery ordering is unavailable.",
    );
  }
}

function buildModifierSnapshots(
  item: MenuItemWithPricingRelations,
  selectedOptionIds: string[],
  itemIndex: number,
): {
  modifiers: PricedOrderItemModifierSnapshot[];
  modifiersTotalCentsPerUnit: number;
} {
  const assignedGroups = item.modifierGroups
    .filter((assignment) => assignment.modifierGroup.isActive)
    .map((assignment) => assignment.modifierGroup);
  const optionById = new Map(
    assignedGroups.flatMap((group) =>
      group.options.map((option) => [option.id, { option, group }] as const),
    ),
  );
  const selectedCountByGroupId = new Map<string, number>();
  const modifiers: PricedOrderItemModifierSnapshot[] = [];
  let modifiersTotalCentsPerUnit = 0;

  for (const optionId of selectedOptionIds) {
    const match = optionById.get(optionId);

    if (!match) {
      throw new OrderPricingError(
        "INVALID_MODIFIER_OPTION",
        "Modifier option is not available for this item.",
        { itemIndex, menuItemId: item.id, modifierOptionId: optionId },
      );
    }

    const { option, group } = match;

    if (!option.isActive || !option.isAvailable) {
      throw new OrderPricingError(
        "MODIFIER_OPTION_UNAVAILABLE",
        "Modifier option is unavailable.",
        { itemIndex, modifierOptionId: option.id },
      );
    }

    selectedCountByGroupId.set(
      group.id,
      (selectedCountByGroupId.get(group.id) ?? 0) + 1,
    );
    modifiersTotalCentsPerUnit += option.priceDeltaCents;
    modifiers.push({
      modifierGroupId: group.id,
      modifierOptionId: option.id,
      modifierGroupNameSnapshot: group.name,
      modifierOptionNameSnapshot: option.name,
      priceDeltaCents: option.priceDeltaCents,
      quantity: 1,
    });
  }

  for (const group of assignedGroups) {
    const selectedCount = selectedCountByGroupId.get(group.id) ?? 0;
    const minimum = Math.max(group.minSelections, group.isRequired ? 1 : 0);

    if (selectedCount < minimum) {
      throw new OrderPricingError(
        "MODIFIER_MIN_SELECTIONS",
        `Select at least ${minimum} option(s) for ${group.name}.`,
        { itemIndex, menuItemId: item.id, modifierGroupId: group.id, minimum },
      );
    }

    if (selectedCount > group.maxSelections) {
      throw new OrderPricingError(
        "MODIFIER_MAX_SELECTIONS",
        `Select no more than ${group.maxSelections} option(s) for ${group.name}.`,
        {
          itemIndex,
          menuItemId: item.id,
          modifierGroupId: group.id,
          maximum: group.maxSelections,
        },
      );
    }
  }

  return { modifiers, modifiersTotalCentsPerUnit };
}

function calculateTipCents(
  tip: PriceCartInput["tip"],
  tipBasisCents: number,
): number {
  if (tip.amountCents !== undefined) {
    return tip.amountCents;
  }

  if (tip.percent !== undefined) {
    return calculatePpmAmountCents(tipBasisCents, Math.round(tip.percent * 10_000));
  }

  return 0;
}

export async function priceCart(
  rawInput: unknown,
  client: PricingDbClient = db,
): Promise<PricedCart> {
  const input = priceCartSchema.parse(rawInput);
  const settings = await getOrderSettings(client);

  validateServiceType(input.serviceType, settings);

  const uniqueItemIds = [...new Set(input.items.map((item) => item.menuItemId))];
  const menuItems = await client.menuItem.findMany({
    where: { id: { in: uniqueItemIds } },
    include: menuItemInclude,
  });
  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  const pricedItems: PricedOrderItemSnapshot[] = [];
  let itemsSubtotalCents = 0;

  for (const [itemIndex, cartItem] of input.items.entries()) {
    ensureUniqueModifierOptions(cartItem.modifierOptionIds, itemIndex);

    const menuItem = itemById.get(cartItem.menuItemId);
    if (!menuItem) {
      throw new OrderPricingError("ITEM_NOT_FOUND", "Menu item was not found.", {
        itemIndex,
        menuItemId: cartItem.menuItemId,
      });
    }

    validateItemAvailability(menuItem, itemIndex);

    const { modifiers, modifiersTotalCentsPerUnit } = buildModifierSnapshots(
      menuItem,
      cartItem.modifierOptionIds,
      itemIndex,
    );
    const modifiersTotalCents = modifiersTotalCentsPerUnit * cartItem.quantity;
    const lineSubtotalCents =
      (menuItem.priceCents + modifiersTotalCentsPerUnit) * cartItem.quantity;

    itemsSubtotalCents += lineSubtotalCents;
    pricedItems.push({
      menuItemId: menuItem.id,
      menuItemNameSnapshot: menuItem.name,
      menuItemDescriptionSnapshot: menuItem.description,
      quantity: cartItem.quantity,
      unitPriceCents: menuItem.priceCents,
      modifiersTotalCents,
      lineSubtotalCents,
      specialInstructions: cartItem.specialInstructions,
      sortOrder: itemIndex,
      modifiers,
    });
  }

  const delivery =
    input.serviceType === OrderServiceType.DELIVERY
      ? await validateDelivery(
          {
            address: input.deliveryAddress,
            itemsSubtotalCents,
          },
          client,
        )
      : null;
  const deliveryFeeCents = delivery?.deliveryFeeCents ?? 0;
  const taxes = calculateQuebecTaxCents(
    itemsSubtotalCents,
    settings.gstRatePpm,
    settings.qstRatePpm,
  );
  const tipCents = calculateTipCents(input.tip, itemsSubtotalCents);
  const discountCents = 0;
  const totalCents =
    itemsSubtotalCents +
    taxes.taxCents +
    tipCents +
    deliveryFeeCents -
    discountCents;

  return {
    serviceType: input.serviceType,
    currency: CAD_CURRENCY_CODE,
    itemsSubtotalCents,
    taxableSubtotalCents: taxes.taxableSubtotalCents,
    gstCents: taxes.gstCents,
    qstCents: taxes.qstCents,
    taxCents: taxes.taxCents,
    tipCents,
    deliveryFeeCents,
    discountCents,
    totalCents,
    delivery,
    items: pricedItems,
  };
}
