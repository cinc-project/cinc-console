import { currentUser } from "@/lib/guard";
import { loadFleetSnapshot } from "@/lib/cinc/fleet-snapshot";
import { nowMs } from "@/lib/cinc/client";
import { explainRead } from "@/lib/cinc/safe-get";
import { NodesTable } from "@/components/nodes-table";
import { ClientKeptNotice } from "@/components/node/client-kept-notice";

export default async function NodesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org } = await params;
  const { deleted, client_kept } = await searchParams;
  const notice = <ClientKeptNotice org={org} deleted={deleted} reason={client_kept} />;
  const user = await currentUser();
  const base = `/orgs/${org}/nodes`;
  // The fleet snapshot (the same search that powers the dashboard) carries each
  // node's last check-in and client version, so the list can show those columns
  // without an N+1 fetch. It needs node *search* permission, not just *list*.
  const res = await loadFleetSnapshot(user, org, nowMs());
  if ("error" in res) {
    return (
      <>
        {notice}
        <p className="text-sm text-danger">{explainRead(res.error)}</p>
      </>
    );
  }
  return (
    <>
      {notice}
      <NodesTable
        basePath={base}
        createHref={`${base}/new`}
        nodes={res.data.nodes}
        generatedAt={res.data.generatedAt}
      />
    </>
  );
}
