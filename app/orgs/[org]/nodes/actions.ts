"use server";

import { requireUser } from "@/lib/session";
import { makeResource } from "@/lib/cinc/resource";
import { runAction, parseJsonObject, type ActionResult } from "@/lib/cinc/action";
import { nameError } from "@/lib/cinc/names";

const nodes = makeResource("nodes");

export async function saveNode(
  org: string,
  name: string,
  json: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseJsonObject(json);
  if (!parsed.ok) return { error: "invalid JSON" };
  return runAction(() => nodes.update(user, org, name, parsed.value), {
    revalidate: `/orgs/${org}/nodes`,
  });
}

export async function createNode(
  org: string,
  name: string,
  json: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseJsonObject(json);
  if (!parsed.ok) return { error: "invalid JSON" };
  return runAction(() => nodes.create(user, org, { ...parsed.value, name }), {
    revalidate: `/orgs/${org}/nodes`,
  });
}

export async function deleteNode(
  org: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireUser();
  return runAction(() => nodes.remove(user, org, name), {
    revalidate: `/orgs/${org}/nodes`,
  });
}

/**
 * Move a node to another environment. Re-reads the node and changes only
 * `chef_environment`, so a stale page can't clobber attributes saved since it
 * loaded. `environment` arrives from the client, so it's validated here.
 */
export async function setNodeEnvironment(
  org: string,
  name: string,
  environment: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof environment !== "string" || environment === "" || nameError("environment", environment)) {
    return { error: "invalid environment" };
  }
  return runAction(
    async () => {
      const node = await nodes.get(user, org, name);
      await nodes.update(user, org, name, { ...node, chef_environment: environment });
    },
    { revalidate: `/orgs/${org}/nodes` },
  );
}
