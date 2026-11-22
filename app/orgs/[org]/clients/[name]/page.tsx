import { currentUser } from "@/lib/guard";
import { clients } from "@/lib/cinc/readonly";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { ObjectEditor } from "@/components/object-editor";
import { ClientDetails } from "@/components/details/client-details";
import { deleteClientAction } from "../actions";
import { loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { KeyManager } from "@/components/keys/key-manager";
import { createKey, updateKey, regenerateKey, deleteKey } from "@/app/keys/actions";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const owner: KeyOwner = { kind: "client", org, name };
  const [res, keysRes] = await Promise.all([
    safeGet(() => clients.get(user, org, name)),
    safeGet(() => loadKeys(user, owner)),
  ]);
  if ("error" in res) {
    return <p className="text-sm text-danger">{explainRead(res.error)}</p>;
  }
  return (
    <div className="space-y-10">
    <ObjectEditor
      name={name}
      initialJson={JSON.stringify(res.data, null, 2)}
      details={<ClientDetails data={res.data} />}
      backHref={`/orgs/${org}/clients`}
      readOnly={true}
      onDelete={deleteClientAction.bind(null, org, name)}
    />
    <section className="space-y-4" aria-labelledby="keys-heading">
      <h2 id="keys-heading" className="text-lg font-semibold tracking-tight">
        Keys
      </h2>
      <p className="text-sm text-muted">
        To re-register this client, regenerate its <span className="font-mono">default</span> key
        and install the new private key on the node.
      </p>
      {"error" in keysRes ? (
        <p className="text-sm text-danger">{explainRead(keysRes.error)}</p>
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
    </section>
    </div>
  );
}
