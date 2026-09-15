/** Public online policy; staff also handle historical and phone bookings. */
export const ONLINE_PARTY_SIZES = [6, 7, 8, 9, 10, 11, 12] as const;
export const ONLINE_MIN_PARTY_SIZE = 6;
export const ONLINE_MAX_PARTY_SIZE = 12;
export const ONLINE_DEFAULT_PARTY_SIZE = 6;

export function isOnlinePartySize(partySize: number): boolean {
  return Number.isInteger(partySize) &&
    partySize >= ONLINE_MIN_PARTY_SIZE && partySize <= ONLINE_MAX_PARTY_SIZE;
}
