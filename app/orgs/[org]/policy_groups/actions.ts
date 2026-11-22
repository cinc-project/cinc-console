"use server";

import { requireUser } from "@/lib/session";
import { deletePolicyGroup, removePolicyFromGroup } from "@/lib/cinc/policy-groups";
import { runAction, type ActionResult } from "@/lib/cinc/action";

// Both are bound with (org, group) by the detail page; `policy` is the only
// caller-supplied argument and cincPath vets it as one path segment.

export async function removePolicyFromGroupAction(
  org: string,
  group: string,
  policy: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => removePolicyFromGroup(user, org, group, policy), {
    revalidate: `/orgs/${org}/policy_groups`,
  });
}

export async function deletePolicyGroupAction(
  org: string,
  group: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => deletePolicyGroup(user, org, group), {
    revalidate: `/orgs/${org}/policy_groups`,
  });
}
