import {
  DetailSection,
  FieldGrid,
  Field,
  Badge,
  ScalarValue,
  EmptyState,
  isRecord,
} from "./primitives";

/**
 * Curated read-only view of an API client: its flags and default public key.
 * Its keys are managed in the Keys section of the client page (KeyManager).
 */
export function ClientDetails({ data }: { data: unknown }) {
  const client = isRecord(data) ? data : {};
  const publicKey = client.public_key;

  return (
    <div className="space-y-4">
      <DetailSection title="Overview">
        <FieldGrid>
          <Field label="Name">
            <ScalarValue value={client.name ?? client.clientname} />
          </Field>
          <Field label="Validator">
            <Badge tone={client.validator ? "warn" : "muted"}>
              {client.validator ? "yes" : "no"}
            </Badge>
          </Field>
          <Field label="Admin">
            <Badge tone={client.admin ? "primary" : "muted"}>
              {client.admin ? "yes" : "no"}
            </Badge>
          </Field>
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Public key">
        {/* `publicKey` is a client's PUBLIC key shown in the UI, not a secret;
            `!== ""` is a presence check, not a credential comparison. The
            timing-attack rule misfires on the `publicKey` name alone. */}
        {typeof publicKey === "string" && publicKey !== "" ? ( // nosemgrep: js-timing-attack-string-comparison
          <pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-muted">
            {publicKey}
          </pre>
        ) : (
          <EmptyState>No public key.</EmptyState>
        )}
      </DetailSection>
    </div>
  );
}
