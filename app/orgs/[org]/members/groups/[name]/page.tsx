import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { members } from "@/lib/cinc/members";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { permissionsDenied } from "@/lib/cinc/acl-access";
import { ObjectEditor } from "@/components/object-editor";
import { GroupDetails } from "@/components/details/group-details";
import { saveGroup, deleteGroup } from "../../actions";

export default async function GroupDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const base = `/orgs/${org}/members`;
  const [res, denied] = await Promise.all([
    safeGet(() => members.getGroup(user, org, name)),
    permissionsDenied(user, org, { kind: "groups", name }),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <GroupDetails
          data={res.data}
          onSaveMembers={saveGroup.bind(null, org, name)}
        />
      }
      backHref={base}
      permissionsHref={permissionsHref(org, { kind: "groups", name: name })}
      permissionsDenied={denied}
      onSave={saveGroup.bind(null, org, name)}
      onDelete={deleteGroup.bind(null, org, name)}
    />
  );
}
