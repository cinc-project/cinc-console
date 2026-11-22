import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { getAcl } from "@/lib/cinc/acl";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { AclEditor } from "@/components/acl-editor";
import { KIND_LABELS, type AclKind, type AclTarget } from "@/lib/acl-kinds";
import { savePermission } from "./actions";

/** Where a target's own page is in the console, for the back link. */
function objectHref(org: string, target: AclTarget): string {
  const base = `/orgs/${org}`;
  if (target.kind === "organization") return `${base}/permissions`;
  const n = encodeURIComponent(target.name);
  const pages: Partial<Record<AclKind, string>> = {
    nodes: `${base}/nodes/${n}`,
    roles: `${base}/roles/${n}`,
    environments: `${base}/environments/${n}`,
    data: `${base}/data_bags/${n}`,
    clients: `${base}/clients/${n}`,
    groups: `${base}/members/groups/${n}`,
    cookbooks: `${base}/cookbooks/${n}`,
    policies: `${base}/policies/${n}`,
    users: `${base}/members/users/${n}`,
  };
  return pages[target.kind] ?? `${base}/permissions`;
}

/** One target's ACL, editable when the server lets the viewer read it. */
export async function AclPage({ org, target }: { org: string; target: AclTarget }) {
  const user = await currentUser();
  const res = await safeGet(() => getAcl(user, org, target));
  const title =
    target.kind === "organization"
      ? `Organization ${org}`
      : `${KIND_LABELS[target.kind]} ${target.name}`;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="space-y-1">
        <Link href={objectHref(org, target)} className="text-sm text-muted hover:text-link">
          <span aria-hidden="true">←</span> Back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Permissions: {title}</h1>
        {target.kind === "containers" && (
          <p className="text-sm text-muted">
            A container&apos;s <span className="font-mono">create</span> decides who may
            make new {target.name}. The other permissions are the defaults for listing them.
          </p>
        )}
        {target.kind === "organization" && (
          <p className="text-sm text-muted">
            Removing a member from the organization takes{" "}
            <span className="font-mono">update</span> here.
          </p>
        )}
      </div>
      {"error" in res ? (
        <p className="text-sm text-danger">
          {res.error === "forbidden"
            ? "You need grant permission here to see these permissions."
            : explainRead(res.error)}
        </p>
      ) : (
        <AclEditor acl={res.data} onSave={savePermission.bind(null, org, target)} />
      )}
    </div>
  );
}
