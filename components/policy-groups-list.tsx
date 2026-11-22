import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { CommandSnippet } from "@/components/command-snippet";
import { PolicyGroupsIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/ui/page-header";
import { RevisionId, revisionHref } from "@/components/revision-id";
import type { PolicyGroupSummary } from "@/lib/cinc/policy-groups";

const PUSH_COMMANDS = {
  cinc: ["cinc policy push GROUP"],
  knife: ["chef push GROUP"],
};

/** Each group with the policies pinned in it and the revision each one runs. */
export function PolicyGroupsList({
  org,
  groups,
}: {
  org: string;
  groups: PolicyGroupSummary[];
}) {
  const base = `/orgs/${org}`;
  const header = (
    <PageHeader
      title="Policy Groups"
      description={
        <>
          The revision of each policy that nodes in a group run. Pin or promote
          a revision by pushing it from your workstation.
        </>
      }
    />
  );

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState
          illustration={<PolicyGroupsIllustration />}
          title="No policy groups yet"
          actions={
            <CommandSnippet
              commands={PUSH_COMMANDS}
              notes={{
                knife:
                  "knife has no Policyfile commands; these come with your workstation's Policyfile tooling.",
              }}
            />
          }
        >
          A policy group is a stage such as staging or production. Pushing a
          policy to a group creates it and pins that revision for its nodes.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Policy groups and the policy revisions pinned in each
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="px-4 py-2 font-medium">
                Group
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Pinned policies
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.name}
                className="border-b border-border align-top last:border-0"
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <Link
                    href={`${base}/policy_groups/${encodeURIComponent(g.name)}`}
                    className="font-mono text-text transition-colors hover:text-link"
                  >
                    {g.name}
                  </Link>
                </th>
                <td className="px-4 py-2.5">
                  {g.policies.length === 0 ? (
                    <span className="text-muted">No policies</span>
                  ) : (
                    <ul className="space-y-1">
                      {g.policies.map((p) => (
                        <li key={p.policy} className="flex flex-wrap gap-x-2">
                          <Link
                            href={`${base}/policies/${encodeURIComponent(p.policy)}`}
                            className="font-mono text-text transition-colors hover:text-link"
                          >
                            {p.policy}
                          </Link>
                          <Link
                            href={revisionHref(org, p.policy, p.revision)}
                            className="text-muted transition-colors hover:text-link"
                          >
                            <span className="sr-only">{p.policy}</span>{" "}
                            revision <RevisionId revision={p.revision} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
