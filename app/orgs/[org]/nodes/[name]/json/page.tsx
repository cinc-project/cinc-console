import { NodeJsonPanel } from "@/components/node/node-json-panel";
import { saveNode } from "../../actions";
import { loadNode, nodeParams } from "../data";

export default async function NodeJsonPage({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name } = await nodeParams(params);
  const res = await loadNode(org, name);
  if ("error" in res) return null; // the layout explains the failure
  return (
    <NodeJsonPanel
      name={name}
      initialJson={JSON.stringify(res.data.node, null, 2)}
      onSave={saveNode.bind(null, org, name)}
    />
  );
}
