import { Prisma } from "@prisma/client";
import { z } from "zod";
import { drinkItemUpdateSchema } from "./validation";

export class DrinkConflict extends Error {}
export const snapshot = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function updateDrink(tx: Prisma.TransactionClient, id: string, payload: z.infer<typeof drinkItemUpdateSchema>, actorId: string) {
  const { expectedUpdatedAt, ...data } = payload;
  // Lock the row so the before snapshot, revision check, write and audit agree.
  await tx.$queryRaw`SELECT "id" FROM "DrinkItem" WHERE "id" = ${id} FOR UPDATE`;
  const before = await tx.drinkItem.findUniqueOrThrow({ where: { id } });
  if (before.updatedAt.toISOString() !== expectedUpdatedAt) throw new DrinkConflict("This drink was changed elsewhere. Reload its latest version before saving.");
  const item = await tx.drinkItem.update({ where: { id }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } });
  await tx.drinkMenuEvent.create({ data: { actorId, action: "item.update", entityId: id, before: snapshot(before), after: snapshot(item) } });
  return item;
}
