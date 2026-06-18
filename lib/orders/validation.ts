import { OrderServiceType, ReservationLanguage } from "@prisma/client";
import { z } from "zod";

const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null));

export const orderServiceTypeSchema = z.nativeEnum(OrderServiceType);

export const cartItemSchema = z.object({
  menuItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  modifierOptionIds: z.array(z.string().trim().min(1)).default([]),
  specialInstructions: nullableText(500),
});

export const tipSelectionSchema = z
  .object({
    amountCents: z.coerce.number().int().min(0).max(100_000).optional(),
    percent: z.coerce.number().min(0).max(100).optional(),
  })
  .refine(
    (value) => value.amountCents === undefined || value.percent === undefined,
    "Provide either amountCents or percent, not both.",
  )
  .default({});

export const deliveryAddressSchema = z.object({
  addressLine1: z.string().trim().min(1).max(180),
  addressLine2: nullableText(120),
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(80).default("QC"),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(2).default("CA"),
  deliveryInstructions: nullableText(500),
});

export const priceCartSchema = z.object({
  serviceType: orderServiceTypeSchema,
  items: z.array(cartItemSchema).min(1).max(100),
  tip: tipSelectionSchema,
  deliveryAddress: deliveryAddressSchema.optional(),
}).refine(
  (value) =>
    value.serviceType !== OrderServiceType.DELIVERY || Boolean(value.deliveryAddress),
  "Delivery address is required for delivery orders.",
);

export const deliveryValidationSchema = z.object({
  address: deliveryAddressSchema,
  itemsSubtotalCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(7).max(40),
  email: z
    .union([z.string().trim().email().max(254), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  language: z.nativeEnum(ReservationLanguage).default(ReservationLanguage.FR),
});

export const checkoutCreateSchema = priceCartSchema.extend({
  customer: checkoutCustomerSchema,
  customerNotes: nullableText(1000),
});

export const orderSettingsUpdateSchema = z
  .object({
    onlineOrderingEnabled: z.coerce.boolean().optional(),
    pickupEnabled: z.coerce.boolean().optional(),
    deliveryEnabled: z.coerce.boolean().optional(),
    restaurantLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    restaurantLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    deliveryRadiusKm: z.coerce.number().positive().max(100).optional(),
    deliveryFeeCents: z.coerce.number().int().min(0).max(100_000).optional(),
    minimumDeliveryOrderCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
    freeDeliveryThresholdCents: z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable()
      .optional(),
    orderAdminSmsRecipient: z
      .union([z.string().trim().min(7).max(40), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine(
    (value) =>
      value.freeDeliveryThresholdCents === undefined ||
      value.freeDeliveryThresholdCents === null ||
      value.minimumDeliveryOrderCents === undefined ||
      value.freeDeliveryThresholdCents >= value.minimumDeliveryOrderCents,
    "Free delivery threshold cannot be below the minimum delivery order.",
  );

export const menuCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: nullableText(500),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const menuCategoryUpdateSchema = menuCategoryCreateSchema.partial();

export const menuItemCreateSchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  description: nullableText(1000),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  imageUrl: z
    .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  sortOrder: z.coerce.number().int().default(0),
  isAvailable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
});

export const menuItemUpdateSchema = menuItemCreateSchema.partial();

const modifierGroupBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: nullableText(500),
  minSelections: z.coerce.number().int().min(0).max(99),
  maxSelections: z.coerce.number().int().min(0).max(99),
  isRequired: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
  isActive: z.coerce.boolean(),
});

export const modifierGroupCreateSchema = modifierGroupBaseSchema
  .extend({
    minSelections: modifierGroupBaseSchema.shape.minSelections.default(0),
    maxSelections: modifierGroupBaseSchema.shape.maxSelections.default(1),
    isRequired: modifierGroupBaseSchema.shape.isRequired.default(false),
    sortOrder: modifierGroupBaseSchema.shape.sortOrder.default(0),
    isActive: modifierGroupBaseSchema.shape.isActive.default(true),
  })
  .refine(
    (value) => value.minSelections <= value.maxSelections,
    "Minimum selections cannot exceed maximum selections.",
  );

export const modifierGroupUpdateSchema = modifierGroupBaseSchema
  .partial()
  .refine(
    (value) =>
      value.minSelections === undefined ||
      value.maxSelections === undefined ||
      value.minSelections <= value.maxSelections,
    "Minimum selections cannot exceed maximum selections.",
  );

export const modifierOptionCreateSchema = z.object({
  modifierGroupId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  priceDeltaCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  sortOrder: z.coerce.number().int().default(0),
  isAvailable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
});

export const modifierOptionUpdateSchema = modifierOptionCreateSchema.partial();

export const itemModifierGroupCreateSchema = z.object({
  menuItemId: z.string().trim().min(1),
  modifierGroupId: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

export const itemModifierGroupUpdateSchema = z.object({
  sortOrder: z.coerce.number().int(),
});

export type PriceCartInput = z.infer<typeof priceCartSchema>;
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
export type DeliveryValidationInput = z.infer<typeof deliveryValidationSchema>;
