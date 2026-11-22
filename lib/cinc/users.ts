import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

export type User = {
  username: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  public_key?: string;
  [k: string]: unknown;
};

/** The global user record (GET /users/<name>). Never includes a password. */
export const getUser = (user: string) =>
  cincRequest<User>({ user, method: "GET", path: cincPath`/users/${user}` });

/**
 * Replace the global user record (PUT /users/<name>). The server replaces the
 * whole object, so callers must send the full record; a `password` field is
 * stashed out-of-band to change the web-login password.
 */
export const putUser = (user: string, body: User & { password?: string }) =>
  cincRequest<unknown>({ user, method: "PUT", path: cincPath`/users/${user}`, body });

/**
 * Users other than the signed-in one. The global record (/users/<name>) and
 * its password are the user's own, the superuser's, or a server admin's to
 * read and change; any member of an org can read a fellow member through
 * /organizations/<org>/users/<name>. Creating users is for the superuser and
 * server admins, and adding one to an org without an invitation is for the
 * superuser only. The server enforces all of this; these only make requests.
 */
export const users = {
  get: (actor: string, name: string) =>
    cincRequest<User>({ user: actor, method: "GET", path: cincPath`/users/${name}` }),

  /** PUT merges into the stored record, but the server requires display_name and email. */
  put: (actor: string, name: string, body: User & { password?: string }) =>
    cincRequest<unknown>({ user: actor, method: "PUT", path: cincPath`/users/${name}`, body }),

  /**
   * Create a user with a key: the pasted public key, or else a pair the server
   * generates (create_key), whose private half is returned once. A user with no
   * key can't sign requests, and cinc-server-ng won't impersonate one.
   */
  async create(
    actor: string,
    fields: { username: string; display_name: string; email: string; first_name?: string; last_name?: string; password?: string; external_authentication_uid?: string },
    publicKey?: string,
  ): Promise<{ privateKey: string | undefined }> {
    const body = publicKey ? { ...fields, public_key: publicKey } : { ...fields, create_key: true };
    const res = await cincRequest<{ chef_key?: { private_key?: string }; private_key?: string }>({
      user: actor,
      method: "POST",
      path: cincPath`/users`,
      body,
    });
    return { privateKey: res?.chef_key?.private_key ?? res?.private_key };
  },

  /** Delete the user from the whole server (every org, group and key). */
  remove: (actor: string, name: string) =>
    cincRequest<unknown>({ user: actor, method: "DELETE", path: cincPath`/users/${name}` }),

  getMember: (actor: string, org: string, name: string) =>
    cincRequest<User>({ user: actor, org, method: "GET", path: cincPath`/users/${name}` }),

  addMember: (actor: string, org: string, name: string) =>
    cincRequest<unknown>({
      user: actor,
      org,
      method: "POST",
      path: cincPath`/users`,
      body: { username: name },
    }),
};
