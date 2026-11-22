import Link from "next/link";
import { permissionsHref } from "@/lib/acl-kinds";
import { currentUser } from "@/lib/guard";
import { clients } from "@/lib/cinc/readonly";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { DetailRow } from "@/components/ui/detail-rows";
import { ClientDetails, clientFlags } from "@/components/details/client-details";
import { deleteClientAction } from "../actions";
import { loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { KeyManager } from "@/components/keys/key-manager";
import { createKey, updateKey, regenerateKey, deleteKey } from "@/app/keys/actions";
import { ClientHeader } from "./client-header";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const owner: KeyOwner = { kind: "client", org, name };
  const backHref = `/orgs/${org}/clients`;
  const [res, keysRes] = await Promise.all([
    safeGet(() => clients.get(user, org, name)),
    safeGet(() => loadKeys(user, owner)),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  const { validator, admin } = clientFlags(res.data);

  return (
    <div className="max-w-3xl space-y-5">
      {/* nosemgrep: js-open-redirect -- same-origin path */}
      <Link href={backHref} className="text-sm text-muted hover:text-text">
        ← back
      </Link>
      <ClientHeader
        name={name}
        json={JSON.stringify(res.data, null, 2)}
        validator={validator}
        admin={admin}
        backHref={backHref}
        permissionsHref={permissionsHref(org, { kind: "clients", name })}
        onDelete={deleteClientAction.bind(null, org, name)}
      >
        <ClientDetails data={res.data} />
        <DetailRow label={"data" in keysRes ? `Keys (${keysRes.data.length})` : "Keys"}>
          <p className="mb-3 text-muted">
            {validator ? (
              <>
                To rotate the validator key, regenerate its{" "}
                <span className="font-mono">default</span> key and update it wherever you
                bootstrap nodes from.
              </>
            ) : (
              <>
                To re-register this client, regenerate its{" "}
                <span className="font-mono">default</span> key and install the new private key
                on the node.
              </>
            )}
          </p>
          {"error" in keysRes ? (
            <p className="text-danger">{explainRead(keysRes.error)}</p>
          ) : (
            <KeyManager
              owner={name}
              rows={keysRes.data}
              onCreate={createKey.bind(null, owner)}
              onUpdate={updateKey.bind(null, owner)}
              onRegenerate={regenerateKey.bind(null, owner)}
              onDelete={deleteKey.bind(null, owner)}
            />
          )}
        </DetailRow>
      </ClientHeader>
    </div>
  );
}
