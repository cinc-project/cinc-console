import { NodeHardware } from "@/components/node/node-hardware";
import { loadNode, nodeParams } from "../data";

export default async function NodeHardwarePage({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name, base } = await nodeParams(params);
  const res = await loadNode(org, name);
  if ("error" in res) return null; // the layout explains the failure
  return <NodeHardware base={base} facts={res.data.facts} />;
}
