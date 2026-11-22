/**
 * Key expiration dates. The server takes "infinity" or a UTC timestamp written
 * exactly as YYYY-MM-DDThh:mm:ssZ (cinc-server-ng rejects it without the Z).
 * The console works in whole days: a key expires at 00:00 UTC on its date.
 * Client-safe: no server imports.
 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Server value for an expiry day, or "infinity" for none. Throws on a bad date. */
export function toExpiration(date: string | null): string {
  if (date === null) return "infinity";
  const m = DATE.exec(date);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  // Date.UTC rolls 2030-02-30 over into March; round-tripping catches it.
  if (!d || d.toISOString().slice(0, 10) !== date) {
    throw new Error(`not a calendar date: ${date}`);
  }
  return `${date}T00:00:00Z`;
}

/** The expiry day of a server value, or null for "infinity" or nothing. */
export function fromExpiration(value: string | undefined): string | null {
  if (!value || value === "infinity") return null;
  return value.slice(0, 10);
}

/** Whether an expiry day has already passed. */
export function isPast(date: string | null, nowMs: number = Date.now()): boolean {
  return date !== null && Date.parse(`${date}T00:00:00Z`) <= nowMs;
}
