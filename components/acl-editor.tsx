"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/cinc/action";
import { PERMS, PERM_HELP, type Perm } from "@/lib/acl-kinds";

export type AclView = Record<Perm, { actors: string[]; groups: string[] }>;

function explain(error: string): string {
  switch (error) {
    case "forbidden":
      return "You need grant permission here to change these permissions.";
    case "admins grant":
      return "Only the superuser can take the admins group out of grant.";
    case "not found":
      return "This no longer exists.";
    default:
      return error;
  }
}

function Names({ names, empty }: { names: string[]; empty: string }) {
  if (names.length === 0) return <span className="text-muted">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {names.map((n) => (
        <li key={n} className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs text-text">
          {n}
        </li>
      ))}
    </ul>
  );
}

/** Editable list of names: each with a remove button, plus an add field. */
function NameListEditor({
  label,
  perm,
  names,
  onChange,
}: {
  label: string;
  perm: Perm;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  const [entry, setEntry] = useState("");
  const id = `acl-${perm}-${label.replace(/\W+/g, "-").toLowerCase()}`;
  function add(e?: React.FormEvent) {
    e?.preventDefault();
    const n = entry.trim();
    if (n && !names.includes(n)) onChange([...names, n]);
    setEntry("");
  }
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1">
        {names.map((n) => (
          <li key={n} className="flex items-center gap-1 rounded bg-surface-2 py-0.5 pl-2 pr-1 font-mono text-xs text-text">
            {n}
            <button
              type="button"
              onClick={() => onChange(names.filter((x) => x !== n))}
              aria-label={`Remove ${n} from ${perm}`}
              className="rounded px-1 text-muted hover:text-danger focus-visible:outline focus-visible:outline-2"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Add to {label.toLowerCase()} ({perm})
        </label>
        <Input
          id={id}
          value={entry}
          placeholder={label === "Groups" ? "group name" : "user or client name"}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(e);
          }}
          className="max-w-[14rem]"
        />
        <Button type="button" variant="secondary" onClick={() => add()} disabled={!entry.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

/**
 * The five permissions of one ACL. Each row shows who holds it (actors, which
 * are users and clients together, and groups) and edits on its own: Save
 * replaces just that permission.
 */
export function AclEditor({
  acl,
  onSave,
}: {
  acl: AclView;
  onSave: (perm: Perm, entry: { actors: string[]; groups: string[] }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ perm: Perm; actors: string[]; groups: string[] } | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!editing) return;
    const { perm, actors, groups } = editing;
    setStatus(null);
    startTransition(async () => {
      const res = await onSave(perm, { actors, groups });
      if ("ok" in res) {
        setEditing(null);
        setStatus({ kind: "ok", text: `Saved ${perm}.` });
        router.refresh();
      } else {
        setStatus({ kind: "err", text: explain(res.error) });
      }
    });
  }

  return (
    <div className="space-y-3">
      {status && (
        <p role={status.kind === "err" ? "alert" : "status"} className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {status.text}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Permissions</caption>
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Permission</th>
              <th scope="col" className="px-4 py-2 font-medium">Users and clients</th>
              <th scope="col" className="px-4 py-2 font-medium">Groups</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PERMS.map((perm) => {
              const isEditing = editing?.perm === perm;
              return (
                <tr key={perm} className="border-b border-border align-top last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <div className="font-mono text-text">{perm}</div>
                    <div className="text-xs text-muted">{PERM_HELP[perm]}</div>
                  </th>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <NameListEditor
                        label="Users and clients"
                        perm={perm}
                        names={editing.actors}
                        onChange={(actors) => setEditing({ ...editing, actors })}
                      />
                    ) : (
                      <Names names={acl[perm].actors} empty="None" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <NameListEditor
                        label="Groups"
                        perm={perm}
                        names={editing.groups}
                        onChange={(groups) => setEditing({ ...editing, groups })}
                      />
                    ) : (
                      <Names names={acl[perm].groups} empty="None" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="secondary" onClick={() => setEditing(null)} disabled={pending}>
                            Cancel
                          </Button>
                          <Button onClick={save} disabled={pending} aria-label={`Save ${perm}`}>
                            {pending ? "Saving…" : "Save"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          disabled={pending || editing !== null}
                          aria-label={`Edit ${perm}`}
                          onClick={() => {
                            setStatus(null);
                            setEditing({ perm, actors: [...acl[perm].actors], groups: [...acl[perm].groups] });
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
