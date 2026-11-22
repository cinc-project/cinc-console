import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { makeResource } from "@/lib/cinc/resource";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { EnvironmentDetails } from "@/components/details/environment-details";
import {
  saveEnvironment,
  deleteEnvironment,
  createEnvironment,
} from "../actions";

const environments = makeResource("environments");

export default async function EnvironmentDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const base = `/orgs/${org}/environments`;
  const res = await safeGet(() => environments.get(user, org, name));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  if (name === "_default") {
    return (
      <ObjectEditor
        name={name}
        initialJson={JSON.stringify(res.data, null, 2)}
        details={<EnvironmentDetails data={res.data} />}
        backHref={base}
        permissionsHref={permissionsHref(org, { kind: "environments", name })}
        onDuplicate={createEnvironment.bind(null, org)}
        nameKind="environment"
        readOnly={true}
      />
    );
  }
  return (
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={
        <EnvironmentDetails
          data={res.data}
          onSaveOverview={saveEnvironment.bind(null, org, name)}
          onSaveConstraints={saveEnvironment.bind(null, org, name)}
        />
      }
      backHref={base}
      permissionsHref={permissionsHref(org, { kind: "environments", name })}
      onSave={saveEnvironment.bind(null, org, name)}
      onDelete={deleteEnvironment.bind(null, org, name)}
      onDuplicate={createEnvironment.bind(null, org)}
      nameKind="environment"
    />
  );
}
