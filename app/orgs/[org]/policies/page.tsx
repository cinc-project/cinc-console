import { currentUser } from "@/lib/guard";
import { policies } from "@/lib/cinc/readonly";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ResourceTable } from "@/components/resource-table";
import { EmptyState } from "@/components/empty-state";
import { CommandSnippet } from "@/components/command-snippet";
import { PoliciesIllustration } from "@/components/illustrations";

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();
  const res = await safeGet(() => policies.list(user, org));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return (
    <ResourceTable
      title="Policies"
      names={Object.keys(res.data)}
      basePath={`/orgs/${org}/policies`}
      empty={
        <EmptyState
          illustration={<PoliciesIllustration />}
          title="No policies yet"
          actions={
            <CommandSnippet
              commands={{
                cinc: ["cinc policy install", "cinc policy push GROUP"],
                knife: ["chef install", "chef push GROUP"],
              }}
              notes={{
                knife:
                  "knife has no Policyfile commands; these come with your workstation's Policyfile tooling.",
              }}
            />
          }
        >
          A Policyfile locks a node&apos;s run list and every cookbook version
          together. Push it from your workstation to a policy group.
        </EmptyState>
      }
    />
  );
}
