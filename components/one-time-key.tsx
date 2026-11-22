"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * A private key the server returned once (a new client, a generated or
 * regenerated key). It can't be fetched again, so the user is told to save it
 * now and can copy it or download it as `<filename>.pem`.
 */
export function OneTimeKey({
  filename,
  privateKey,
  label,
  hint,
  actions,
}: {
  filename: string;
  privateKey: string;
  /** Accessible name of the key text, e.g. "Private key for web01". */
  label: string;
  /** Where the key is used, appended to the warning. */
  hint?: ReactNode;
  /** Extra buttons after Copy and Download, e.g. Done. */
  actions?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the key and copy manually.");
    }
  }

  function downloadKey() {
    const blob = new Blob([privateKey], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div
        role="alert"
        className="rounded-md border border-warn/50 bg-warn/10 p-3 text-sm text-text"
      >
        <strong>Save this private key now.</strong> It is shown only once and
        cannot be retrieved later.{hint ? <> {hint}</> : null}
      </div>

      <textarea
        readOnly
        rows={14}
        value={privateKey}
        aria-label={label}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-text"
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={copyKey}>{copied ? "Copied ✓" : "Copy key"}</Button>
        <Button variant="secondary" onClick={downloadKey}>
          Download .pem
        </Button>
        {actions}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
