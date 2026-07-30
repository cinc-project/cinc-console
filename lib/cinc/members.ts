import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

/**
 * Org membership: users and groups.
 *
 * Users live at /users and are invited via /association_requests (the cinc
 * server's invitation flow). Groups live at /groups, where the list endpoint
 * returns a { name → url } map and each group is a JSON object edited in place.
 */
export const members = {
  listUsers: (user: string, org: string) =>
    cincRequest<Array<{ user: { username: string } }>>({
      user,
      org,
      method: "GET",
      path: cincPath`/users`,
    }),
  invite: (user: string, org: string, username: string) =>
    cincRequest<unknown>({
      user,
      org,
      method: "POST",
      path: cincPath`/association_requests`,
      body: { user: username },
    }),
  removeUser: (user: string, org: string, username: string) =>
    cincRequest<unknown>({
      user,
      org,
      method: "DELETE",
      path: cincPath`/users/${username}`,
    }),
  listGroups: (user: string, org: string) =>
    cincRequest<Record<string, string>>({
      user,
      org,
      method: "GET",
      path: cincPath`/groups`,
    }),
  getGroup: (user: string, org: string, group: string) =>
    cincRequest<Record<string, unknown>>({
      user,
      org,
      method: "GET",
      path: cincPath`/groups/${group}`,
    }),
  updateGroup: (
    user: string,
    org: string,
    group: string,
    body: Record<string, unknown>,
  ) =>
    cincRequest<unknown>({
      user,
      org,
      method: "PUT",
      path: cincPath`/groups/${group}`,
      body,
    }),
  deleteGroup: (user: string, org: string, group: string) =>
    cincRequest<unknown>({
      user,
      org,
      method: "DELETE",
      path: cincPath`/groups/${group}`,
    }),
};
