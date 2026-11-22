"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { IconWarning } from "@/components/ui/icons";
import { OneTimeKey } from "@/components/one-time-key";
import { nameError } from "@/lib/cinc/names";
import { daysUntil, isPast } from "@/lib/key-expiry";
import type { KeyRow } from "@/lib/cinc/keys";
import type { KeyChanges, KeyResult, NewKey } from "@/app/keys/actions";

function explain(error: string): string {
  switch (error) {
    case "forbidden":
      return "You don't have permission to change these keys.";
    case "not found":
      return "That key no longer exists.";
    case "already exists":
      return "A key with that name already exists.";
    case "last key":
      return "This is the user's last valid key. Without one they can't sign in to the console or use the API, so add another key first.";
    case "invalid name":
      return "Use only letters, numbers, and . : _ - in key names.";
    case "invalid date":
      return "Enter a valid expiry date.";
    default:
      return error;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Never expires" plus a date, as one labelled group. */
function ExpiryField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-muted">Expiry</legend>
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={value === null}
          onChange={(e) => onChange(e.target.checked ? null : today())}
        />
        Never expires
      </label>
      {value !== null && (
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="block text-sm text-muted">
            Expires on (00:00 UTC)
          </label>
          <Input
            id={`${id}-date`}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}
    </fieldset>
  );
}

/** Days before expiry at which a key is flagged as expiring soon. */
const SOON_DAYS = 14;

function AddKeyDialog({
  onCreate,
  onCreated,
  onCancel,
}: {
  onCreate: (input: NewKey) => Promise<KeyResult>;
  onCreated: (name: string, privateKey: string | undefined) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"generate" | "paste">("generate");
  const [publicKey, setPublicKey] = useState("");
  const [expires, setExpires] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameErr = nameError("key", name);
  const missingKey = mode === "paste" && !publicKey.trim();

  function submit() {
    setError(null);
    const n = name.trim();
    startTransition(async () => {
      const res = await onCreate({
        name: n,
        publicKey: mode === "paste" ? publicKey : undefined,
        expires,
      });
      if ("ok" in res) {
        onCreated(n, res.privateKey);
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <FormDialog
      title="Add a key"
      submitLabel="Add key"
      canSubmit={!!name.trim() && !nameErr && !missingKey}
      pending={pending}
      error={error}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <div className="space-y-1">
        <label htmlFor={`${id}-name`} className="block text-sm text-muted">
          Name
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          aria-invalid={nameErr ? true : undefined}
          aria-describedby={nameErr ? `${id}-name-err` : undefined}
        />
        {nameErr && (
          <p id={`${id}-name-err`} role="alert" className="text-sm text-danger">
            {nameErr}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">Key pair</legend>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={mode === "generate"}
            onChange={() => setMode("generate")}
          />
          Generate a new pair on the server (the private key is shown once)
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={mode === "paste"}
            onChange={() => setMode("paste")}
          />
          Use my own public key (the private key never leaves your machine)
        </label>
      </fieldset>

      {mode === "paste" && (
        <div className="space-y-1">
          <label htmlFor={`${id}-pub`} className="block text-sm text-muted">
            Public key (PEM)
          </label>
          <textarea
            id={`${id}-pub`}
            rows={8}
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            spellCheck={false}
            placeholder="-----BEGIN PUBLIC KEY-----"
            className="w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-text"
          />
        </div>
      )}

      <ExpiryField value={expires} onChange={setExpires} />
    </FormDialog>
  );
}

/** Status cell text: expired, expiring soon (with the day count) or active. */
function KeyStatus({ row }: { row: KeyRow }) {
  const date = row.expires ?? null;
  if (row.expired || isPast(date)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <span aria-hidden="true">
          <IconWarning />
        </span>
        Expired
      </span>
    );
  }
  const days = daysUntil(date);
  if (days !== null && days <= SOON_DAYS) {
    return (
      <span className="inline-flex items-center gap-1.5 text-warn">
        <span aria-hidden="true">
          <IconWarning />
        </span>
        {days === 1 ? "Expires tomorrow" : `Expires in ${days} days`}
      </span>
    );
  }
  return <span className="text-muted">Active</span>;
}

type Dialog =
  | { kind: "edit"; key: KeyRow; name: string; expires: string | null }
  | { kind: "regenerate"; key: KeyRow }
  | { kind: "delete"; key: KeyRow }
  | null;

/**
 * Lists an actor's keys and manages them: add (generated or pasted), rename
 * and change expiry, regenerate in place, and delete. Every change goes
 * through a pre-bound server action; a private key the server returns is shown
 * once with OneTimeKey.
 */
export function KeyManager({
  owner,
  rows,
  onCreate,
  onUpdate,
  onRegenerate,
  onDelete,
}: {
  /** The user or client name, for the downloaded key's filename. */
  owner: string;
  rows: KeyRow[];
  onCreate: (input: NewKey) => Promise<KeyResult>;
  onUpdate: (key: string, changes: KeyChanges) => Promise<KeyResult>;
  onRegenerate: (key: string) => Promise<KeyResult>;
  onDelete: (key: string) => Promise<KeyResult>;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [revealed, setRevealed] = useState<{ key: string; privateKey: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const revealedRef = useRef<HTMLHeadingElement>(null);

  // A new private key replaces whatever had focus (a closed dialog's opener);
  // move focus to it so a screen reader reads the "save this now" warning.
  useEffect(() => {
    if (revealed) revealedRef.current?.focus();
  }, [revealed]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editNameErr = dialog?.kind === "edit" ? nameError("key", dialog.name) : null;

  function act(fn: () => Promise<KeyResult>, key: string) {
    setDialog(null);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("ok" in res) {
        if (res.privateKey) setRevealed({ key, privateKey: res.privateKey });
        router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  function confirm() {
    if (!dialog) return;
    const k = dialog.key.name;
    if (dialog.kind === "edit") {
      if (editNameErr || !dialog.name.trim()) return;
      act(() => onUpdate(k, { name: dialog.name, expires: dialog.expires }), dialog.name.trim());
    } else if (dialog.kind === "regenerate") {
      act(() => onRegenerate(k), k);
    } else {
      act(() => onDelete(k), k);
    }
  }

  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {revealed && (
        <div className="max-w-2xl space-y-2">
          <h3 ref={revealedRef} tabIndex={-1} className="text-base font-semibold focus:outline-none">
            Private key for <span className="font-mono">{revealed.key}</span>
          </h3>
          <OneTimeKey
            filename={`${owner}-${revealed.key}`}
            privateKey={revealed.privateKey}
            label={`Private key ${revealed.key} for ${owner}`}
            actions={
              <Button variant="ghost" onClick={() => setRevealed(null)}>
                Done
              </Button>
            }
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <p className="p-4 text-sm text-muted">No keys.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Keys</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2 font-medium">Expires</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => {
                return (
                  <tr key={k.name} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-text">{k.name}</td>
                    <td className="px-4 py-2 text-muted">
                      {k.expires === undefined ? "Unknown" : (k.expires ?? "Never")}
                    </td>
                    <td className="px-4 py-2">
                      <KeyStatus row={k} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <ActionMenu
                        label={`Actions for key ${k.name}`}
                        items={[
                          {
                            label: "Edit",
                            hint: "Rename or change expiry",
                            disabled: pending,
                            onSelect: () =>
                              setDialog({ kind: "edit", key: k, name: k.name, expires: k.expires ?? null }),
                          },
                          {
                            label: "Regenerate",
                            hint: "Shows a new private key once",
                            disabled: pending,
                            onSelect: () => setDialog({ kind: "regenerate", key: k }),
                          },
                          "separator",
                          {
                            label: "Delete",
                            danger: true,
                            disabled: pending,
                            onSelect: () => setDialog({ kind: "delete", key: k }),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={dialog?.kind === "edit"}
        title={`Edit key ${dialog?.key.name ?? ""}`}
        confirmLabel="Save"
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      >
        {dialog?.kind === "edit" && (
          <div className="space-y-4 text-text">
            <div className="space-y-1">
              <label htmlFor="edit-key-name" className="block text-sm text-muted">
                Name
              </label>
              <Input
                id="edit-key-name"
                value={dialog.name}
                onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                aria-invalid={editNameErr ? true : undefined}
                aria-describedby={editNameErr ? "edit-key-name-err" : undefined}
              />
              {editNameErr && (
                <p id="edit-key-name-err" role="alert" className="text-sm text-danger">
                  {editNameErr}
                </p>
              )}
            </div>
            <ExpiryField
              value={dialog.expires}
              onChange={(v) => setDialog({ ...dialog, expires: v })}
            />
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "regenerate"}
        title={`Regenerate key ${dialog?.key.name ?? ""}?`}
        confirmLabel="Regenerate"
        confirmVariant="danger"
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      >
        The server makes a new pair and shows its private key once. Anything
        still signing with the current private key stops working immediately.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete key ${dialog?.key.name ?? ""}?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      >
        Anything signing with this key stops working immediately. This can&apos;t
        be undone.
      </ConfirmDialog>

      <Button variant="secondary" onClick={() => setAdding(true)}>
        Add key…
      </Button>
      {adding && (
        <AddKeyDialog
          onCreate={onCreate}
          onCancel={() => setAdding(false)}
          onCreated={(name, privateKey) => {
            setAdding(false);
            if (privateKey) setRevealed({ key: name, privateKey });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
