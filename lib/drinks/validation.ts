import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().transform(value => value || null).optional();
const imageUrl = z.union([
  z.string().trim().url().max(2000).refine(value => ["http:", "https:"].includes(new URL(value).protocol), { message: "Image URL must use HTTP or HTTPS." }),
  z.literal(""), z.null(),
]).transform(value => value || null).optional();
const sortOrder = z.number().int().min(-10_000).max(10_000);
const categoryFields = {
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  sortOrder,
};
export const drinkCategoryCreateSchema = z.object({ ...categoryFields, sortOrder: sortOrder.default(0) });
export const drinkCategoryUpdateSchema = z.object(categoryFields).partial();
const itemFields = {
  categoryId: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(160),
  nameFr: z.string().trim().min(1).max(160),
  descriptionEn: nullableText(1000),
  descriptionFr: nullableText(1000),
  imageUrl,
  priceCents: z.number().int().min(0).max(1_000_000).nullable(),
  isVisible: z.boolean(),
  sortOrder,
};
export const drinkItemCreateSchema = z.object({ ...itemFields, isVisible: z.boolean().default(true), sortOrder: sortOrder.default(0) });
// Do not partial() a schema with defaults: omitted PATCH fields must stay omitted.
export const drinkItemUpdateSchema = z.object(itemFields).partial().extend({
  expectedUpdatedAt: z.iso.datetime(),
}).refine(value => Object.keys(value).some(key => key !== "expectedUpdatedAt"), { message: "No changes supplied." });
