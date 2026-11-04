import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonClass } from "@/components/ui/button";
import { currentUser } from "@/lib/guard";
import { clients } from "@/lib/cinc/readonly";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ResourceTable } from "@/components/resource-table";
import { ClientsIllustration } from "@/components/illustrations";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();
  const res = await safeGet(() => clients.list(user, org));
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const base = `/orgs/${org}/clients`;
  const names = Object.keys(res.data);
  // Every org is created with a validator client; on its own it still means
  // "no clients of your own yet".
  const validator = `${org}-validator`;
  const hasValidator = names.includes(validator);
  return (
    <ResourceTable
      title="Clients"
      names={names}
      basePath={base}
      createHref={`${base}/new`}
      builtIn={[validator]}
      empty={
        <EmptyState
          illustration={<ClientsIllustration />}
          title={
            hasValidator ? (
              <>
                Only <code className="font-mono">{validator}</code> so far
              </>
            ) : (
              "No clients yet"
            )
          }
          actions={
            <>
              <Link href={`${base}/new`} className={buttonClass()}>
                New client
              </Link>
              {hasValidator && (
                <Link
                  href={`${base}/${encodeURIComponent(validator)}`}
                  className="text-sm text-link hover:underline"
                >
                  View <span className="font-mono">{validator}</span>
                </Link>
              )}
            </>
          }
        >
          Clients are API identities. Each node gets its own when it&apos;s
          bootstrapped; create one for CI jobs or scripts.
        </EmptyState>
      }
    />
  );
}
