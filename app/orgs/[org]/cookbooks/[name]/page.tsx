import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { cookbooks } from "@/lib/cinc/readonly";
import { parseCookbookVersions } from "@/lib/cinc/cookbooks";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { CookbookVersions } from "@/components/details/cookbook-versions";
import { DetailSection } from "@/components/details/primitives";
import { AttributeTree } from "@/components/details/attribute-tree";
import { deleteCookbookAction, deleteCookbookVersionAction } from "../actions";

export default async function CookbookDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const res = await safeGet(() => cookbooks.get(user, org, name));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const versions = parseCookbookVersions(res.data);
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <div className="space-y-4">
          <CookbookVersions
            org={org}
            name={name}
            versions={versions}
            onDeleteVersion={deleteCookbookVersionAction.bind(null, org, name)}
            onDeleteCookbook={deleteCookbookAction.bind(null, org, name)}
          />
          <DetailSection title="Details">
            <AttributeTree data={res.data} defaultOpen={false} />
          </DetailSection>
        </div>
      }
      backHref={`/orgs/${org}/cookbooks`}
      permissionsHref={permissionsHref(org, { kind: "cookbooks", name: name })}
      readOnly={true}
    />
  );
}
