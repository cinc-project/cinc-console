import "server-only";
import { cincRequest } from "./client";
import { isCincError } from "./errors";
import { cincPath, type CincPath } from "./path";

/**
 * Public keys of a user (global, /users/<name>/keys) or an API client
 * (/organizations/<org>/clients/<name>/keys). Each actor may have several
 * named keys, each with its own expiry; "default" is the one created with the
 * actor. Who may manage them is the server's call: a user's keys are theirs
 * (and the superuser's), a client's follow the client's ACL.
 */
export type KeyOwner =
  | { kind: "user"; name: string }
  | { kind: "client"; org: string; name: string };

/** One row of a key list, with the expiry day (null: never; undefined: unknown). */
export type KeyRow = { name: string; expired: boolean; expires: string | null | undefined };

type KeyDetail = { name: string; public_key?: string; expiration_date?: string };

function where(owner: KeyOwner, key?: string): { org: string | undefined; path: CincPath } {
  if (owner.kind === "user") {
    return {
      org: undefined,
      path:
        key === undefined
          ? cincPath`/users/${owner.name}/keys`
          : cincPath`/users/${owner.name}/keys/${key}`,
    };
  }
  return {
    org: owner.org,
    path:
      key === undefined
        ? cincPath`/clients/${owner.name}/keys`
        : cincPath`/clients/${owner.name}/keys/${key}`,
  };
}

export const keys = {
  list: (user: string, owner: KeyOwner) =>
    cincRequest<Array<{ name: string; uri?: string; expired: boolean }>>({
      user,
      ...where(owner),
      method: "GET",
    }),

  get: (user: string, owner: KeyOwner, key: string) =>
    cincRequest<KeyDetail>({ user, ...where(owner, key), method: "GET" }),

  /**
   * Add a key. With a public key the server stores it; without one it
   * generates a pair and returns the private half, **once**. erchef only
   * generates when asked with create_key; cinc-server-ng generates whenever
   * public_key is absent, so sending both forms keeps either happy.
   */
  async create(
    user: string,
    owner: KeyOwner,
    input: { name: string; publicKey?: string; expirationDate: string },
  ): Promise<{ privateKey: string | undefined }> {
    const body = input.publicKey
      ? { name: input.name, public_key: input.publicKey, expiration_date: input.expirationDate }
      : { name: input.name, create_key: true, expiration_date: input.expirationDate };
    const res = await cincRequest<{ private_key?: string }>({
      user,
      ...where(owner),
      method: "POST",
      body,
    });
    return { privateKey: res?.private_key };
  },

  /** Rename a key or change its expiry. Only the fields given are sent. */
  update: (user: string, owner: KeyOwner, key: string, fields: { name?: string; expiration_date?: string }) =>
    cincRequest<unknown>({ user, ...where(owner, key), method: "PUT", body: fields }),

  /**
   * Replace a key's pair in place and return the new private key. One request,
   * so the actor is never left without the key (unlike delete-then-create).
   */
  async regenerate(user: string, owner: KeyOwner, key: string): Promise<string> {
    const res = await cincRequest<{ private_key?: string }>({
      user,
      ...where(owner, key),
      method: "PUT",
      body: { create_key: true },
    });
    if (!res?.private_key) throw new Error("the server returned no private key");
    return res.private_key;
  },

  remove: (user: string, owner: KeyOwner, key: string) =>
    cincRequest<unknown>({ user, ...where(owner, key), method: "DELETE" }),
};

/**
 * The key list joined with each key's expiry, which only the per-key GET
 * returns. A key whose detail can't be read still lists, its expiry unknown.
 */
export async function loadKeys(user: string, owner: KeyOwner): Promise<KeyRow[]> {
  const list = await keys.list(user, owner);
  return Promise.all(
    list.map(async (k) => {
      let expires: string | null | undefined;
      try {
        const d = await keys.get(user, owner, k.name);
        expires = !d.expiration_date || d.expiration_date === "infinity" ? null : d.expiration_date.slice(0, 10);
      } catch (e) {
        if (!isCincError(e)) throw e;
        expires = undefined;
      }
      return { name: k.name, expired: k.expired === true, expires };
    }),
  );
}
