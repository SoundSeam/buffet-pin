import { z } from "zod";

const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null));

const imageUrl = z
  .union([
    z
      .string()
      .trim()
      .url()
      .max(2000)
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "Image URL must use HTTP or HTTPS.",
      }),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => (value ? value : null));

export const drinkCategoryCreateSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
});

export const drinkCategoryUpdateSchema = drinkCategoryCreateSchema.partial();

export const drinkItemCreateSchema = z.object({
  categoryId: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(160),
  nameFr: z.string().trim().min(1).max(160),
  descriptionEn: nullableText(1000),
  descriptionFr: nullableText(1000),
  imageUrl,
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
});

export const drinkItemUpdateSchema = drinkItemCreateSchema.partial();
