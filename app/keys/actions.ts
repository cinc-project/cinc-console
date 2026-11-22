"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { keys, loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { isCincError } from "@/lib/cinc/errors";
import { isUnsafePathError } from "@/lib/cinc/path";
import { nameError } from "@/lib/cinc/names";
import { toExpiration, isPast } from "@/lib/key-expiry";

/**
 * Key management for a user or an API client. Every action is bound to its
 * owner on the server (`.bind(null, owner)`), but a Server Action is a public
 * endpoint whose types are erased, so the owner and every field are checked
 * again here. Who may change which keys is still the server's decision.
 */
export type KeyResult = { ok: true; privateKey?: string } | { error: string };
export type NewKey = { name: string; publicKey?: string; expires: string | null };
export type KeyChanges = { name?: string; expires?: string | null };

function validOwner(o: unknown): o is KeyOwner {
  if (!o || typeof o !== "object") return false;
  const v = o as Record<string, unknown>;
  if (typeof v.name !== "string") return false;
  return v.kind === "user" || (v.kind === "client" && typeof v.org === "string");
}

function pathFor(owner: KeyOwner): string {
  return owner.kind === "user" ? "/profile" : `/orgs/${owner.org}/clients`;
}

/** The server's own explanation from an error body, if it gave one. */
function serverReason(body: unknown): string | null {
  const e = body && typeof body === "object" ? (body as { error?: unknown }).error : body;
  if (Array.isArray(e)) return e.filter((s) => typeof s === "string").join(" ") || null;
  return typeof e === "string" ? e : null;
}

async function run(owner: KeyOwner, fn: () => Promise<string | void>): Promise<KeyResult> {
  try {
    const privateKey = await fn();
    revalidatePath(pathFor(owner), "layout");
    return privateKey ? { ok: true, privateKey } : { ok: true };
  } catch (e) {
    if (isCincError(e)) {
      if (e.forbidden) return { error: "forbidden" };
      if (e.notFound) return { error: "not found" };
      if (e.conflict) return { error: "already exists" };
      const reason = e.status === 400 ? serverReason(e.body) : null;
      if (reason) return { error: `The server rejected this: ${reason}` };
      return { error: `server error (${e.status})` };
    }
    if (isUnsafePathError(e)) return { error: "invalid name" };
    throw e;
  }
}

/** A day as the server's expiration value, or null if it isn't a real date. */
function expiration(day: string | null): string | null {
  try {
    return toExpiration(day);
  } catch {
    return null;
  }
}

/**
 * Whether removing `key` (or giving it `newExpiry`) would leave a user with no
 * key that's still valid. cinc-server-ng won't impersonate such a user, so it
 * would lock them out of the console, and they couldn't sign API requests
 * either. Clients are exempt: the console never signs as one.
 */
async function locksOut(
  user: string,
  owner: KeyOwner,
  key: string,
  newExpiry?: string | null,
): Promise<boolean> {
  if (owner.kind !== "user") return false;
  if (newExpiry !== undefined && !isPast(newExpiry)) return false;
  const active = (await loadKeys(user, owner)).filter(
    (k) => !k.expired && !isPast(k.expires ?? null),
  );
  return active.some((k) => k.name === key) && active.every((k) => k.name === key);
}

export async function createKey(owner: KeyOwner, input: NewKey): Promise<KeyResult> {
  const user = await requireUser();
  if (!validOwner(owner)) return { error: "invalid owner" };
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name || nameError("key", name)) return { error: "invalid name" };
  const expires = expiration(input.expires ?? null);
  if (!expires) return { error: "invalid date" };
  const publicKey =
    typeof input.publicKey === "string" && input.publicKey.trim() ? input.publicKey.trim() : undefined;
  return run(owner, async () => {
    const res = await keys.create(user, owner, { name, publicKey, expirationDate: expires });
    return res.privateKey;
  });
}

export async function updateKey(
  owner: KeyOwner,
  key: string,
  changes: KeyChanges,
): Promise<KeyResult> {
  const user = await requireUser();
  if (!validOwner(owner) || typeof key !== "string") return { error: "invalid owner" };
  const fields: { name?: string; expiration_date?: string } = {};
  if (typeof changes?.name === "string" && changes.name.trim() !== key) {
    const name = changes.name.trim();
    if (!name || nameError("key", name)) return { error: "invalid name" };
    fields.name = name;
  }
  if (changes?.expires !== undefined) {
    const expires = expiration(changes.expires);
    if (!expires) return { error: "invalid date" };
    fields.expiration_date = expires;
  }
  if (Object.keys(fields).length === 0) return { ok: true };
  return run(owner, async () => {
    if (await locksOut(user, owner, key, changes.expires)) throw new LastKey();
    await keys.update(user, owner, key, fields);
  }).catch(lastKey);
}

export async function regenerateKey(owner: KeyOwner, key: string): Promise<KeyResult> {
  const user = await requireUser();
  if (!validOwner(owner) || typeof key !== "string") return { error: "invalid owner" };
  return run(owner, () => keys.regenerate(user, owner, key));
}

export async function deleteKey(owner: KeyOwner, key: string): Promise<KeyResult> {
  const user = await requireUser();
  if (!validOwner(owner) || typeof key !== "string") return { error: "invalid owner" };
  return run(owner, async () => {
    if (await locksOut(user, owner, key)) throw new LastKey();
    await keys.remove(user, owner, key);
  }).catch(lastKey);
}

/** Thrown inside run() to stop before the request; mapped to "last key". */
class LastKey extends Error {}

function lastKey(e: unknown): KeyResult {
  if (e instanceof LastKey) return { error: "last key" };
  throw e;
}
