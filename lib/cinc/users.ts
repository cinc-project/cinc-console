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
