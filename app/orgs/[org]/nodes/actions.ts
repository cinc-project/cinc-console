"use server";

import { requireUser } from "@/lib/session";
import { makeResource } from "@/lib/cinc/resource";
import { runAction, parseJsonObject, type ActionResult } from "@/lib/cinc/action";
import { nameError } from "@/lib/cinc/names";
import { revalidatePath } from "next/cache";
import { clients } from "@/lib/cinc/readonly";
import { deleteClient } from "@/lib/cinc/clients";
import { isCincError } from "@/lib/cinc/errors";
import { clientKeptMessage, type ClientKeptReason } from "@/lib/node-delete";

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

/** The node is gone but its client isn't; `clientKept` says why. */
export type DeleteNodeResult =
  | ActionResult
  | { error: string; clientKept: ClientKeptReason };

/**
 * Delete a node and, when `alsoDeleteClient` is exactly `true`, then the API
 * client of the same name, whose key would otherwise still authenticate. The
 * flag arrives from the browser, so anything but `true` means node only.
 */
export async function deleteNode(
  org: string,
  name: string,
  alsoDeleteClient?: unknown,
): Promise<DeleteNodeResult> {
  const user = await requireUser();
  const res = await runAction(() => nodes.remove(user, org, name), {
    revalidate: `/orgs/${org}/nodes`,
  });
  if (!("ok" in res) || alsoDeleteClient !== true) return res;
  const kept = await deletePairedClient(user, org, name);
  revalidatePath(`/orgs/${org}/clients`, "layout");
  return kept ? { error: clientKeptMessage(name, kept), clientKept: kept } : res;
}

/**
 * Delete client `name` unless it's the org's validator, which this path never
 * removes (the UI doesn't offer it; this guards a hand-made request). A client
 * that is already gone counts as deleted.
 */
async function deletePairedClient(
  user: string,
  org: string,
  name: string,
): Promise<ClientKeptReason | null> {
  try {
    const client = await clients.get(user, org, name);
    if (isValidator(client)) return "validator";
    await deleteClient(user, org, name);
    return null;
  } catch (e) {
    if (!isCincError(e)) throw e;
    if (e.notFound) return null;
    return e.forbidden ? "forbidden" : "error";
  }
}

function isValidator(client: unknown): boolean {
  return typeof client === "object" && client !== null && (client as { validator?: unknown }).validator === true;
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
