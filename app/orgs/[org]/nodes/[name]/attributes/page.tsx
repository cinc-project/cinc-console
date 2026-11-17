import { AttributesView } from "@/components/node/attributes-view";
import { loadNode, nodeParams } from "../data";

export default async function NodeAttributesPage({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name } = await nodeParams(params);
  const res = await loadNode(org, name);
  if ("error" in res) return null; // the layout explains the failure
  const { node } = res.data;
  return (
    <AttributesView
      levels={{
        default: node.default,
        normal: node.normal,
        override: node.override,
        automatic: node.automatic,
      }}
    />
  );
}
