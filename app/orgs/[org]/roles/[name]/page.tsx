import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { makeResource } from "@/lib/cinc/resource";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { RoleDetails } from "@/components/details/role-details";
import { saveRole, deleteRole, createRole } from "../actions";

const roles = makeResource("roles");

export default async function RoleDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const base = `/orgs/${org}/roles`;
  const res = await safeGet(() => roles.get(user, org, name));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <RoleDetails
          data={res.data}
          onSaveRunList={saveRole.bind(null, org, name)}
          onSaveOverview={saveRole.bind(null, org, name)}
        />
      }
      backHref={base}
      permissionsHref={permissionsHref(org, { kind: "roles", name: name })}
      onSave={saveRole.bind(null, org, name)}
      onDelete={deleteRole.bind(null, org, name)}
      onDuplicate={createRole.bind(null, org)}
      nameKind="role"
    />
  );
}
