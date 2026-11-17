import { NodeOverview } from "@/components/node/node-overview";
import { loadNode, nodeParams } from "./data";

export default async function NodeOverviewPage({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name, base } = await nodeParams(params);
  const res = await loadNode(org, name);
  if ("error" in res) return null; // the layout explains the failure
  const { facts, now, clientStatus, lifecycle } = res.data;
  return (
    <NodeOverview
      org={org}
      base={base}
      facts={facts}
      now={now}
      clientStatus={clientStatus}
      lifecycle={lifecycle}
    />
  );
}
