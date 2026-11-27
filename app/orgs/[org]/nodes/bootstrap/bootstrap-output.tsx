"use client";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { CommandLine } from "@/components/command-line";
import { IconWarning } from "@/components/ui/icons";

function Terminal({
  title,
  label,
  copyValue,
  children,
}: {
  title: string;
  label: string;
  copyValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <CopyButton value={copyValue} label="Copy" className="ml-auto" />
      </div>
      <pre
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-text/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {children}
      </pre>
    </div>
  );
}

/** The `cinc node bootstrap` command; nothing is created by the console. */
export function SshOutput({
  lines,
  watching,
  onWatch,
}: {
  /** null while the name or settings are invalid. */
  lines: string[] | null;
  watching: boolean;
  onWatch: () => void;
}) {
  if (!lines) {
    return <p className="text-sm text-muted">Enter a valid name to see the command.</p>;
  }
  // Continue the first line so the copied text runs as one command.
  const display = lines.map((l, i) => (i < lines.length - 1 ? `${l} \\` : l));
  return (
    <div className="space-y-3">
      <Terminal title="Run on your workstation" label="Bootstrap command" copyValue={display.join("\n")}>
        {display.map((l, i) => (
          <span key={i} className="block">
            <CommandLine line={l} />
          </span>
        ))}
      </Terminal>
      <p className="text-xs text-muted">
        The Cinc CLI creates the client and key, installs Cinc Client over SSH (using sudo), and
        does the first run. First time on this workstation? Run{" "}
        <code className="font-mono">cinc config create</code>.
      </p>
      {!watching && (
        <Button variant="secondary" onClick={onWatch}>
          I&apos;ve run it
        </Button>
      )}
    </div>
  );
}

/** Create the client on demand, then the one-time script that embeds its key. */
export function PasteOutput({
  name,
  script,
  canCreate,
  pending,
  error,
  canDiscard,
  onCreate,
  onDiscard,
}: {
  name: string;
  /** Set once the client exists. */
  script: string | null;
  canCreate: boolean;
  pending: boolean;
  error: string | null;
  canDiscard: boolean;
  onCreate: () => void;
  onDiscard: () => void;
}) {
  function download() {
    if (!script) return;
    const url = URL.createObjectURL(new Blob([script], { type: "text/x-shellscript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bootstrap-${name}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!script) {
    return (
      <div className="space-y-2">
        <Button onClick={onCreate} disabled={!canCreate || pending}>
          {pending ? "Creating…" : "Create client and show script"}
        </Button>
        <p className="text-xs text-muted">
          Creates the API client and its key. The machine&apos;s first run creates the node.
        </p>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <span aria-hidden="true">
              <IconWarning />
            </span>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-warn/50 bg-warn/10 p-3 text-sm"
      >
        <span aria-hidden="true" className="mt-0.5 text-warn">
          <IconWarning />
        </span>
        <p>
          <strong>This script contains the new client key and is shown only once.</strong> Copy
          or download it now. You can make a new key from the client page later.
        </p>
      </div>
      <Terminal
        title="Paste on the machine, in a shell where you can sudo"
        label="Bootstrap script"
        copyValue={script}
      >
        {script}
      </Terminal>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={download}>
          Download bootstrap-{name}.sh
        </Button>
        {canDiscard && (
          <Button variant="ghost" onClick={onDiscard} disabled={pending}>
            Discard
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <span aria-hidden="true">
            <IconWarning />
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
