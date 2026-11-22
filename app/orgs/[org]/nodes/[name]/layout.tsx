import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { permissionsDenied } from "@/lib/cinc/acl-access";
import { PermissionsButton } from "@/components/permissions-button";
import type { ReactNode } from "react";
import { explainRead } from "@/lib/cinc/safe-get";
import { NodeSidebar } from "@/components/node/node-sidebar";
import { NodeTabs } from "@/components/node/node-tabs";
import { NodeDeleteButton } from "@/components/node/node-delete-button";
import { deleteNode } from "../actions";
import { loadNode, loadPairedClient, nodeParams } from "./data";

/**
 * Shared frame for every node tab: the identity card on the left and the tab
 * strip above the active tab's page. A failed read renders here once; the tab
 * pages render nothing in that case.
 */
export default async function NodeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name, base } = await nodeParams(params);
  const user = await currentUser();
  const [res, pairedClient, denied] = await Promise.all([
    loadNode(org, name),
    loadPairedClient(org, name),
    permissionsDenied(user, org, { kind: "nodes", name }),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const { facts, now, clientStatus, lifecycle, os } = res.data;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <NodeSidebar
        org={org}
        name={name}
        base={base}
        facts={facts}
        now={now}
        clientStatus={clientStatus}
        latestMajor={lifecycle.latestMajor}
        os={os}
        deleteButton={
          <div className="flex flex-wrap gap-2">
            <PermissionsButton href={permissionsHref(org, { kind: "nodes", name })} denied={denied} />
            <NodeDeleteButton
              name={name}
              listHref={`/orgs/${org}/nodes`}
              pairedClient={pairedClient}
              onDelete={deleteNode.bind(null, org, name)}
            />
          </div>
        }
      />
      <div className="min-w-0 flex-1 space-y-5">
        <NodeTabs base={base} />
        {children}
      </div>
    </div>
  );
}
