import { DetailRow } from "@/components/ui/detail-rows";
import { CopyButton } from "@/components/ui/copy-button";
import { isRecord } from "./primitives";

/** The client's flags as plain values the page header and rows share. */
export function clientFlags(data: unknown): { validator: boolean; admin: boolean } {
  const client = isRecord(data) ? data : {};
  return { validator: client.validator === true, admin: client.admin === true };
}

/**
 * The Type and Public key rows of a client page. Its keys are a separate row
 * (KeyManager); the name is already the page title.
 */
export function ClientDetails({ data }: { data: unknown }) {
  const client = isRecord(data) ? data : {};
  const { validator, admin } = clientFlags(data);
  const publicKey = client.public_key;

  return (
    <>
      <DetailRow label="Type">
        <p>
          <strong className="font-medium">{validator ? "Validator" : "Client"}</strong>
          <span className="text-muted">
            {validator
              ? " · can only register new clients. Bootstrap uses its key to create each node’s own client."
              : " · signs requests for a node or a tool."}
          </span>
        </p>
        {admin && (
          <p className="mt-1 text-muted">
            <strong className="font-medium text-text">Admin</strong> · can change any object
            in this organization.
          </p>
        )}
      </DetailRow>

      {/* `publicKey` is a client's PUBLIC key shown in the UI, not a secret;
          `!== ""` is a presence check, not a credential comparison. The
          timing-attack rule misfires on the `publicKey` name alone. */}
      {typeof publicKey === "string" && publicKey !== "" ? ( // nosemgrep: js-timing-attack-string-comparison
        <DetailRow
          label="Public key"
          action={<CopyButton value={publicKey} label="Copy public key" />}
        >
          <details>
            <summary className="cursor-pointer text-link">Show public key</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-muted">
              {publicKey}
            </pre>
          </details>
        </DetailRow>
      ) : (
        <DetailRow label="Public key">
          <p className="text-muted">No public key.</p>
        </DetailRow>
      )}
    </>
  );
}
