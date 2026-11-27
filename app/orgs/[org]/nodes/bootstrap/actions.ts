"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { makeResource } from "@/lib/cinc/resource";
import { createClient, deleteClient } from "@/lib/cinc/clients";
import { isCincError } from "@/lib/cinc/errors";
import { bootstrapNameError } from "@/lib/bootstrap/validate";

const nodes = makeResource("nodes");

type Failure = { error: string };

export type CreateBootstrapClientResult = { ok: true; privateKey: string } | Failure;

export type CheckIn =
  | { state: "waiting" }
  | { state: "registered" }
  | { state: "checked-in"; ohaiTime: number; platform: string | null }
  | Failure;

/** `name` arrives from the browser: it must be a string valid as node and client. */
function validName(name: unknown): name is string {
  return typeof name === "string" && name === name.trim() && bootstrapNameError(name) === null;
}

function failure(e: unknown): Failure {
  if (!isCincError(e)) throw e;
  if (e.forbidden) return { error: "forbidden" };
  if (e.conflict) return { error: "already exists" };
  return { error: `server error (${e.status})` };
}

/** The node, or null if it doesn't exist. Other errors propagate. */
async function findNode(user: string, org: string, name: string): Promise<unknown | null> {
  try {
    return await nodes.get(user, org, name);
  } catch (e) {
    if (isCincError(e) && e.notFound) return null;
    throw e;
  }
}

/**
 * Create the API client a pasted bootstrap script authenticates as, and return
 * its one-time private key. Only the client: the machine's first run creates
 * the node as that client (as `cinc node bootstrap` does), so the client owns
 * its node. Refuses a name an existing node already has.
 */
export async function createBootstrapClient(
  org: string,
  name: unknown,
): Promise<CreateBootstrapClientResult> {
  const user = await requireUser();
  if (!validName(name)) return { error: "invalid name" };
  try {
    if (await findNode(user, org, name)) return { error: "node exists" };
    const { privateKey } = await createClient(user, org, name);
    revalidatePath(`/orgs/${org}/clients`, "layout");
    return { ok: true, privateKey };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Undo createBootstrapClient before the machine checks in. Once the node
 * exists it belongs to this client, and deleting the client alone would strand
 * it, so that case is refused (the node page's Delete handles both).
 */
export async function discardBootstrapClient(
  org: string,
  name: unknown,
): Promise<{ ok: true } | Failure> {
  const user = await requireUser();
  if (!validName(name)) return { error: "invalid name" };
  try {
    if (await findNode(user, org, name)) return { error: "node exists" };
    try {
      await deleteClient(user, org, name);
    } catch (e) {
      if (!(isCincError(e) && e.notFound)) throw e;
    }
    revalidatePath(`/orgs/${org}/clients`, "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/** Where a bootstrapping node is: not yet created, created, or through its first run. */
export async function nodeCheckIn(org: string, name: unknown): Promise<CheckIn> {
  const user = await requireUser();
  if (!validName(name)) return { error: "invalid name" };
  try {
    const node = await findNode(user, org, name);
    if (!node) return { state: "waiting" };
    const auto =
      typeof node === "object" && node !== null
        ? ((node as { automatic?: unknown }).automatic as Record<string, unknown> | undefined)
        : undefined;
    const ohaiTime = typeof auto?.ohai_time === "number" ? auto.ohai_time : null;
    if (ohaiTime === null) return { state: "registered" };
    const platform = [str(auto?.platform), str(auto?.platform_version)].filter(Boolean).join(" ");
    return { state: "checked-in", ohaiTime, platform: platform || null };
  } catch (e) {
    return failure(e);
  }
}
