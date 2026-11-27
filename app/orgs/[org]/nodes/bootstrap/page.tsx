import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { getConfig } from "@/lib/config";
import { safeGet } from "@/lib/cinc/safe-get";
import { makeResource } from "@/lib/cinc/resource";
import { clients, cookbooks } from "@/lib/cinc/readonly";
import { fetchFleetNodes } from "@/lib/cinc/search";
import { listPolicyGroups } from "@/lib/cinc/policy-groups";
import { PageHeader } from "@/components/ui/page-header";
import { templatesFromFleet } from "@/lib/bootstrap/templates";
import { BootstrapFlow } from "./bootstrap-flow";
import { createBootstrapClient, discardBootstrapClient, nodeCheckIn } from "./actions";

const environments = makeResource("environments");
const roles = makeResource("roles");

function names(res: { data: Record<string, unknown> } | { error: string }): string[] | null {
  return "data" in res ? Object.keys(res.data ?? {}).sort() : null;
}

export default async function BootstrapNodePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();

  // Each list degrades on its own: a read the user can't do turns its picker
  // into a free-text field rather than failing the page.
  const [fleet, clientList, envs, roleList, cookbookList, groups] = await Promise.all([
    safeGet(() => fetchFleetNodes(user, org)),
    safeGet(() => clients.list(user, org)),
    safeGet(() => environments.list(user, org)),
    safeGet(() => roles.list(user, org)),
    safeGet(() => cookbooks.list(user, org)),
    safeGet(() => listPolicyGroups(user, org)),
  ]);
  const fleetNodes = "data" in fleet ? fleet.data : [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link href={`/orgs/${org}/nodes`} className="text-sm text-muted hover:text-text">
          ← Nodes
        </Link>
        <PageHeader
          title="Bootstrap a node"
          description="Bring a machine you already have under Cinc. How will you reach it?"
        />
      </div>
      <BootstrapFlow
        org={org}
        serverUrl={`${getConfig().serverUrl}/organizations/${org}`}
        templates={templatesFromFleet(fleetNodes)}
        existingNodes={fleetNodes.map((n) => n.name)}
        existingClients={names(clientList) ?? []}
        environments={names(envs)}
        roles={names(roleList)}
        cookbooks={names(cookbookList)}
        policyGroups={
          "data" in groups
            ? groups.data.map((g) => ({
                name: g.name,
                policies: g.policies.map((p) => ({ name: p.policy, revision: p.revision })),
              }))
            : null
        }
        onCreate={createBootstrapClient.bind(null, org)}
        onDiscard={discardBootstrapClient.bind(null, org)}
        onCheckIn={nodeCheckIn.bind(null, org)}
      />
    </div>
  );
}
