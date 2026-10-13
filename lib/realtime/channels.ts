import { createHmac } from "node:crypto";

export type InvalidationEnvelope = {
  entity: string;
  id: string;
  revision: string;
};

export const adminUpdatesChannel = "/updates/admin";

export function opaqueEntityChannel(entity: "order" | "reservation", id: string, secret: string) {
  const opaqueId = createHmac("sha256", secret).update(`${entity}:${id}`).digest("base64url");
  return `/updates/${entity}/${opaqueId}`;
}
