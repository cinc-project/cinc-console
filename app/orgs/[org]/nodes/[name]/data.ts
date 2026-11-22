import "server-only";
import { cache } from "react";
import { currentUser } from "@/lib/guard";
import { makeResource } from "@/lib/cinc/resource";
import { clients } from "@/lib/cinc/readonly";
import { safeGet, type Fetched } from "@/lib/cinc/safe-get";
import { getClientLifecycle } from "@/lib/cinc/client-lifecycle";
import { getOsSupport, type OsSupport } from "@/lib/cinc/os-lifecycle";
import { versionStatus, type ClientLifecycle, type ClientStatus } from "@/lib/cinc/fleet";
import { nodeFacts, type NodeFacts } from "@/lib/cinc/node-facts";
import { nowMs } from "@/lib/cinc/client";

const nodes = makeResource("nodes");

export type NodeContext = {
  /** The node object as the server returned it. */
  node: Record<string, unknown>;
  facts: NodeFacts;
  now: number;
  clientStatus: ClientStatus;
  lifecycle: ClientLifecycle;
  os: OsSupport;
};

/**
 * Everything the node layout and its tab pages need, fetched once per request:
 * React's `cache` dedupes the call between the layout (sidebar) and whichever
 * tab page renders beside it. The lifecycle lookups are cached for a day and
 * degrade to "unknown" on their own, so they never block the node.
 */
export const loadNode = cache(
  async (org: string, name: string): Promise<Fetched<NodeContext>> => {
    const user = await currentUser();
    const res = await safeGet(() => nodes.get(user, org, name));
    if ("error" in res) return res;
    const facts = nodeFacts(res.data);
    const now = nowMs();
    const [lifecycle, os] = await Promise.all([
      getClientLifecycle(now),
      getOsSupport(facts.platform, facts.platformVersion, now),
    ]);
    return {
      data: {
        node: res.data,
        facts,
        now,
        // No fleet baseline on a single node: with the lifecycle we still get
        // EOL and major-behind; without it, no warning.
        clientStatus: versionStatus(facts.clientVersion, lifecycle, null),
        lifecycle,
        os,
      },
    };
  },
);

/**
 * Whether the node delete dialog can offer to delete the client of the same
 * name: "deletable" when it exists and isn't the org's validator, "forbidden"
 * when the server won't show it to this user (it may exist, but they couldn't
 * delete it either), null when there's none (or the read failed).
 */
export type PairedClient = "deletable" | "forbidden" | null;

export async function loadPairedClient(org: string, name: string): Promise<PairedClient> {
  const user = await currentUser();
  const res = await safeGet(() => clients.get(user, org, name));
  if ("error" in res) return res.error === "forbidden" ? "forbidden" : null;
  const client = res.data as { validator?: unknown } | null;
  return client?.validator === true ? null : "deletable";
}

/** The route's `[name]` param, decoded the way the list links encode it. */
export async function nodeParams(
  params: Promise<{ org: string; name: string }>,
): Promise<{ org: string; name: string; base: string }> {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  return { org, name, base: `/orgs/${org}/nodes/${encodeURIComponent(name)}` };
}
