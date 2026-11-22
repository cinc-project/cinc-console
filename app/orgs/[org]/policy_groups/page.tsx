import { currentUser } from "@/lib/guard";
import { listPolicyGroups } from "@/lib/cinc/policy-groups";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { PolicyGroupsList } from "@/components/policy-groups-list";

export default async function PolicyGroupsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();
  const res = await safeGet(() => listPolicyGroups(user, org));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return <PolicyGroupsList org={org} groups={res.data} />;
}
