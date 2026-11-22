"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/cinc/users";
import { members, memberList, missingMembers } from "@/lib/cinc/members";
import { isCincError, serverReason } from "@/lib/cinc/errors";
import { isUnsafePathError } from "@/lib/cinc/path";
import type { ActionResult } from "@/lib/cinc/action";
import { getConfig } from "@/lib/config";
import {
  MIN_PASSWORD,
  newUserError,
  pickProfileFields,
  type ProfileDetails,
} from "@/lib/user-fields";

/**
 * Managing other users from an org's members pages. The console acts as the
 * signed-in user, so the server decides who may do what: creating users,
 * editing another user's record or password, and deleting users take the
 * superuser or a server admin; changing `admins` takes an org admin. These
 * actions validate their (untrusted) input and explain what the server says.
 */

export type NewUserInput = ProfileDetails & {
  username: string;
  password?: string;
  /** A PEM public key; without one the server generates a pair. */
  publicKey?: string;
  addToOrg: boolean;
};

/** How the new user ended up relative to the org. */
export type Membership = "added" | "invited" | "none" | "failed";

export type CreateUserResult =
  | { ok: true; privateKey?: string; membership: Membership }
  | { error: string };

function mapError(e: unknown): { error: string } {
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

async function attempt(org: string, fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath(`/orgs/${org}/members`, "layout");
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function createUser(org: string, input: NewUserInput): Promise<CreateUserResult> {
  const actor = await requireUser();
  const ldap = getConfig().authMode === "ldap";
  const username = typeof input?.username === "string" ? input.username.trim() : "";
  const profile = pickProfileFields(input);
  const password = typeof input?.password === "string" ? input.password : undefined;
  const invalid = newUserError({ ...profile, username, password }, { needsPassword: !ldap });
  if (invalid) return { error: invalid };

  const fields = {
    username,
    ...Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
    // An LDAP user has no Cinc password; the directory checks it at login.
    ...(ldap ? { external_authentication_uid: username } : { password }),
  } as Parameters<typeof users.create>[1];
  const publicKey =
    typeof input.publicKey === "string" && input.publicKey.trim() ? input.publicKey.trim() : undefined;

  let privateKey: string | undefined;
  try {
    ({ privateKey } = await users.create(actor, fields, publicKey));
  } catch (e) {
    return mapError(e);
  }

  // Only the superuser may add a member directly; anyone else who can create
  // users (a server admin) falls back to an invitation the user accepts.
  let membership: Membership = "none";
  if (input.addToOrg === true) {
    try {
      await users.addMember(actor, org, username);
      membership = "added";
    } catch (e) {
      if (!isCincError(e)) throw e;
      membership = "failed";
      if (e.forbidden) {
        try {
          await members.invite(actor, org, username);
          membership = "invited";
        } catch (inviteErr) {
          if (!isCincError(inviteErr)) throw inviteErr;
        }
      }
    }
  }
  revalidatePath(`/orgs/${org}/members`, "layout");
  return privateKey ? { ok: true, privateKey, membership } : { ok: true, membership };
}

/** Change another user's profile fields (PUT needs the full record, so merge). */
export async function saveUserProfile(
  org: string,
  name: string,
  details: ProfileDetails,
): Promise<ActionResult> {
  const actor = await requireUser();
  const allowed = pickProfileFields(details);
  return attempt(org, async () => {
    const current = await users.get(actor, name);
    await users.put(actor, name, { ...current, ...allowed });
  });
}

/** Set another user's web-login password. */
export async function setUserPassword(
  org: string,
  name: string,
  password: string,
): Promise<ActionResult> {
  const actor = await requireUser();
  if (getConfig().authMode === "ldap") return { error: "passwords are managed by the directory" };
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { error: "password too short" };
  }
  return attempt(org, async () => {
    const current = await users.get(actor, name);
    await users.put(actor, name, { ...current, password });
  });
}

/**
 * Add a user to, or remove them from, the org's `admins` group. Only the
 * users list is sent, so the group's clients and nested groups are kept.
 * Removing the last admin is refused, and an addition the server silently
 * drops (no such user) is reported.
 */
export async function setAdmin(org: string, name: string, admin: boolean): Promise<ActionResult> {
  const actor = await requireUser();
  if (typeof name !== "string" || typeof admin !== "boolean") return { error: "invalid name" };
  let group: Record<string, unknown>;
  try {
    group = await members.getGroup(actor, org, "admins");
  } catch (e) {
    return mapError(e);
  }
  const current = memberList(group, "users");
  let next: string[];
  if (admin) {
    if (current.includes(name)) return { ok: true };
    next = [...current, name];
  } else {
    if (!current.includes(name)) return { ok: true };
    next = current.filter((n) => n !== name);
    const remaining = next.length + memberList(group, "clients").length + memberList(group, "groups").length;
    if (remaining === 0) return { error: "last admin" };
  }
  let dropped: string[] = [];
  const result = await attempt(org, async () => {
    await members.updateGroup(actor, org, "admins", { groupname: "admins", actors: { users: next } });
    dropped = missingMembers({ users: next }, await members.getGroup(actor, org, "admins"));
  });
  if ("ok" in result && dropped.length > 0) return { error: "not found" };
  return result;
}

/**
 * Delete a user from the whole server: every org, group and key. Refused for
 * the signed-in user (the session would outlive its user) and for `pivotal`,
 * the superuser the server runs as.
 */
export async function deleteUser(org: string, name: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (name === actor) return { error: "self" };
  if (name === "pivotal") return { error: "superuser" };
  return attempt(org, () => users.remove(actor, name));
}
