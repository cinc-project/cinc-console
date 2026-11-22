"use server";

import { requireUser } from "@/lib/session";
import { members, groupUpdateBody, missingMembers } from "@/lib/cinc/members";
import { runAction, parseJsonObject, type ActionResult } from "@/lib/cinc/action";

export async function inviteUser(
  org: string,
  username: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => members.invite(user, org, username), {
    revalidate: `/orgs/${org}/members`,
  });
}

export async function removeUser(
  org: string,
  username: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => members.removeUser(user, org, username), {
    revalidate: `/orgs/${org}/members`,
  });
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

export async function deleteGroup(
  org: string,
  group: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => members.deleteGroup(user, org, group), {
    revalidate: `/orgs/${org}/members`,
  });
}
