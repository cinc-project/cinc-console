"use server";

import { requireUser } from "@/lib/session";
import { members, groupUpdateBody, memberList, missingMembers } from "@/lib/cinc/members";
import { runAction, parseJsonObject, type ActionResult } from "@/lib/cinc/action";
import { isCincError } from "@/lib/cinc/errors";
import { nameError } from "@/lib/cinc/names";

export async function inviteUser(
  org: string,
  username: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => members.invite(user, org, username), {
    revalidate: `/orgs/${org}/members`,
  });
}

export async function cancelInvite(org: string, id: string): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => members.cancelInvite(user, org, id), {
    revalidate: `/orgs/${org}/members`,
  });
}

/** The server's refusal to remove a member who is still an admin. */
function isAdminRefusal(e: unknown): boolean {
  return isCincError(e) && e.forbidden && JSON.stringify(e.body ?? "").includes("admins group");
}

/**
 * Remove a user from the org.
 *
 * The server refuses to remove a member of `admins` (checked through nested
 * groups too) with a 403 that would read as "no permission". So a direct
 * member of `admins` is taken out of it first, unless that would leave the org
 * with no admin at all. Only the users list is sent, so the server keeps the
 * group's clients and nested groups. If `admins` can't be read, the removal is
 * attempted anyway and the server decides.
 */
export async function removeUser(
  org: string,
  username: string,
): Promise<ActionResult> {
  const user = await requireUser();

  let admins: Record<string, unknown> | null = null;
  try {
    admins = await members.getGroup(user, org, "admins");
  } catch (e) {
    if (!isCincError(e)) throw e;
  }
  const adminUsers = memberList(admins, "users");
  const isDirectAdmin = admins !== null && adminUsers.includes(username);
  if (isDirectAdmin) {
    const remaining =
      adminUsers.length - 1 +
      memberList(admins, "clients").length +
      memberList(admins, "groups").length;
    if (remaining === 0) return { error: "last admin" };
  }

  let refused = false;
  const result = await runAction(
    async () => {
      if (isDirectAdmin) {
        await members.updateGroup(user, org, "admins", {
          groupname: "admins",
          actors: { users: adminUsers.filter((n) => n !== username) },
        });
      }
      try {
        await members.removeUser(user, org, username);
      } catch (e) {
        if (!isAdminRefusal(e)) throw e;
        refused = true;
      }
    },
    { revalidate: `/orgs/${org}/members` },
  );
  return refused ? { error: "nested admin" } : result;
}

/**
 * Save a group's membership from an edited group document (the raw JSON editor
 * or the members editor, both of which start from the GET shape). It's
 * rewritten into the update body erchef reads, then read back, because erchef
 * drops names it can't resolve without failing the request.
 */
export async function saveGroup(
  org: string,
  group: string,
  json: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseJsonObject(json);
  if (!parsed.ok) return { error: "invalid JSON" };
  const body = groupUpdateBody(group, parsed.value);
  let missing: string[] = [];
  const result = await runAction(
    async () => {
      await members.updateGroup(user, org, group, body);
      missing = missingMembers(body.actors, await members.getGroup(user, org, group));
    },
    { revalidate: `/orgs/${org}/members` },
  );
  if ("ok" in result && missing.length > 0) {
    return {
      error: `Saved, but the server didn't add ${missing.join(", ")}. Check that a user, client, or group by that name exists.`,
    };
  }
  return result;
}

/**
 * The groups every org is created with. The server doesn't protect them, but
 * deleting one breaks the org (admins, users) or its clients, so the console
 * refuses.
 */
const BUILT_IN_GROUPS = new Set(["admins", "billing-admins", "clients", "users", "public_key_read_access"]);

export async function createGroup(org: string, group: string): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof group !== "string" || nameError("group", group) || !group.trim()) {
    return { error: "invalid name" };
  }
  return runAction(() => members.createGroup(user, org, group.trim()), {
    revalidate: `/orgs/${org}/members`,
  });
}

export async function deleteGroup(
  org: string,
  group: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (BUILT_IN_GROUPS.has(group)) return { error: "built-in group" };
  return runAction(() => members.deleteGroup(user, org, group), {
    revalidate: `/orgs/${org}/members`,
  });
}
