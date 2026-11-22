import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { policies } from "@/lib/cinc/readonly";
import { parsePolicyRevisions } from "@/lib/cinc/policies";
import { groupsByRevision, listPolicyGroups } from "@/lib/cinc/policy-groups";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { PolicyRevisions } from "@/components/details/policy-revisions";
import { DetailSection } from "@/components/details/primitives";
import { AttributeTree } from "@/components/details/attribute-tree";
import { deletePolicyAction, deletePolicyRevisionAction } from "../actions";

export default async function PolicyDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const [res, groups] = await Promise.all([
    safeGet(() => policies.get(user, org, name)),
    // One list call gives every group's pins; a user who can't list groups
    // still gets the policy, just without the "pinned in" badges.
    safeGet(() => listPolicyGroups(user, org)),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const revisions = parsePolicyRevisions(res.data);
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <div className="space-y-4">
          <PolicyRevisions
            org={org}
            name={name}
            revisions={revisions}
            groups={"data" in groups ? groupsByRevision(groups.data, name) : {}}
            onDeleteRevision={deletePolicyRevisionAction.bind(null, org, name)}
            onDeletePolicy={deletePolicyAction.bind(null, org, name)}
          />
          <DetailSection title="Details">
            <AttributeTree data={res.data} defaultOpen={false} />
          </DetailSection>
        </div>
      }
      backHref={`/orgs/${org}/policies`}
      permissionsHref={permissionsHref(org, { kind: "policies", name: name })}
      readOnly={true}
    />
  );
}
