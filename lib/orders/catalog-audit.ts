import { OrderActorType, type Prisma } from "@prisma/client";
type CatalogAuditActor = { staff: { id: string; displayName: string } };

export async function recordCatalogMutation(
  tx: Prisma.TransactionClient,
  actor: CatalogAuditActor,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName, eventType, entityType, entityId, metadata } });
}
