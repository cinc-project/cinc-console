import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import {
  getPolicyGroup,
  listPolicyGroupNodes,
  parsePolicyGroup,
} from "@/lib/cinc/policy-groups";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { PolicyGroupPins } from "@/components/details/policy-group-pins";
import { PolicyGroupNodes } from "@/components/details/policy-group-nodes";
import { deletePolicyGroupAction, removePolicyFromGroupAction } from "../actions";

export default async function PolicyGroupDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const [res, nodes] = await Promise.all([
    safeGet(() => getPolicyGroup(user, org, name)),
    safeGet(() => listPolicyGroupNodes(user, org, name)),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const { policies: pins } = parsePolicyGroup(name, res.data);
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <div className="space-y-4">
          <PolicyGroupPins
            org={org}
            group={name}
            pins={pins}
            onRemovePolicy={removePolicyFromGroupAction.bind(null, org, name)}
            onDeleteGroup={deletePolicyGroupAction.bind(null, org, name)}
          />
          <PolicyGroupNodes
            org={org}
            nodes={"data" in nodes ? nodes.data : []}
            error={"error" in nodes ? explainRead(nodes.error) : undefined}
          />
        </div>
      }
      backHref={`/orgs/${org}/policy_groups`}
      permissionsHref={permissionsHref(org, { kind: "policy_groups", name })}
      readOnly={true}
    />
  );
}
