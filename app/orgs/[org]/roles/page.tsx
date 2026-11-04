import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonClass } from "@/components/ui/button";
import { currentUser } from "@/lib/guard";
import { makeResource } from "@/lib/cinc/resource";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ResourceTable } from "@/components/resource-table";
import { RolesIllustration } from "@/components/illustrations";

const roles = makeResource("roles");

export default async function RolesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();
  const base = `/orgs/${org}/roles`;
  const res = await safeGet(() => roles.list(user, org));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return (
    <ResourceTable
      title="Roles"
      names={Object.keys(res.data)}
      basePath={base}
      createHref={`${base}/new`}
      empty={
        <EmptyState
          illustration={<RolesIllustration />}
          title="No roles yet"
          actions={
            <Link href={`${base}/new`} className={buttonClass()}>
              New role
            </Link>
          }
        >
          A role bundles recipes and attributes into one reusable run list you
          can give to many nodes.
        </EmptyState>
      }
    />
  );
}
