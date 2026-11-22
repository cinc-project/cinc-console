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

const MEMBER_KINDS = ["users", "clients", "groups"] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];
export type GroupMembers = Partial<Record<MemberKind, string[]>>;

/** The body of a group update (PUT /groups/<name>), as erchef reads it. */
export type GroupUpdate = { groupname: string; actors: GroupMembers };

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

/** One member list (users, clients or groups) of a group document. */
export function memberList(doc: Record<string, unknown> | null | undefined, kind: MemberKind): string[] {
  return strings(doc?.[kind]);
}

/**
 * Build a group update from an edited group document.
 *
 * A GET returns `actors` as a flat array plus top-level `users`/`clients`/
 * `groups` lists, but on PUT erchef reads members **only** from a nested
 * `actors: { users, clients, groups }` object and ignores the top-level lists,
 * so sending the GET document back changes nothing. This accepts either shape
 * and emits the nested one. A kind the document doesn't list is left out, which
 * erchef treats as "keep the current members". The name always comes from the
 * path, and every other field is dropped (the input is untrusted).
 */
export function groupUpdateBody(name: string, doc: Record<string, unknown>): GroupUpdate {
  const nested = doc.actors;
  const src =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : doc;
  const actors: GroupMembers = {};
  for (const kind of MEMBER_KINDS) {
    if (Array.isArray(src[kind])) actors[kind] = strings(src[kind]);
  }
  return { groupname: name, actors };
}

/**
 * Names in `wanted` that `saved` doesn't contain. erchef silently drops members
 * it can't resolve (a typo, a deleted client) and still answers 200, so the
 * only way to notice is to read the group back.
 */
export function missingMembers(wanted: GroupMembers, saved: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const kind of MEMBER_KINDS) {
    const have = new Set(strings(saved[kind]));
    for (const name of wanted[kind] ?? []) if (!have.has(name)) out.push(name);
  }
  return out;
}

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
  /** Pending invitations to this org: `[{ id, username }]`. */
  listInvites: (user: string, org: string) =>
    cincRequest<Array<{ id: string; username: string }>>({
      user,
      org,
      method: "GET",
      path: cincPath`/association_requests`,
    }),
  /** Withdraw a pending invitation. The id is `<user>-<org>`. */
  cancelInvite: (user: string, org: string, id: string) =>
    cincRequest<unknown>({
      user,
      org,
      method: "DELETE",
      path: cincPath`/association_requests/${id}`,
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
