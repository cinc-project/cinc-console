import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { policies } from "@/lib/cinc/readonly";
import { parsePolicyRevisions } from "@/lib/cinc/policies";
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
  const res = await safeGet(() => policies.get(user, org, name));
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
