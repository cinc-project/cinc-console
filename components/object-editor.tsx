"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { JsonEditor } from "./json-editor";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { PromptDialog } from "./ui/prompt-dialog";
import { PermissionsButton } from "./permissions-button";
import { JsonDiffView } from "./json-diff-view";
import { diffJson } from "@/lib/json-diff";
import type { ActionResult } from "@/lib/cinc/action";
import type { NameKind } from "@/lib/cinc/names";

function explain(error: string): string {
  if (error === "forbidden")
    return "You don't have permission to do that in this organization.";
  if (error === "built-in group")
    return "Every organization needs this group, so it can't be deleted.";
  return error;
}

/**
 * Reusable detail/edit surface for an object. Save and Delete are server
 * actions passed in by the page; their result drives the inline status. A 403
 * from the server surfaces as a permission message rather than an error page.
 */
export function ObjectEditor({
  name,
  titleIcon,
  initialJson,
  details,
  onSave,
  onDelete,
  onDuplicate,
  nameKind,
  backHref,
  permissionsHref,
  permissionsDenied,
  readOnly = false,
}: {
  name: string;
  /** Optional glyph shown to the left of the name (e.g. a node's platform). */
  titleIcon?: ReactNode;
  initialJson: string;
  /**
   * Curated human-readable view. When provided it is shown by default and the
   * raw JSON becomes an escape hatch reached via the toggle. Without it the
   * editor falls back to JSON-only.
   */
  details?: ReactNode;
  onSave?: (json: string) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  /**
   * Create a copy under a new name. Given the new name and the saved object's
   * JSON; the action injects the name. When set, a Duplicate button appears —
   * even in read-only views, since duplicating is a create, not an edit.
   */
  onDuplicate?: (name: string, json: string) => Promise<ActionResult>;
  /** Validates the new name in the Duplicate dialog against Chef's rules. */
  nameKind?: NameKind;
  backHref: string;
  /** Link to this object's permissions page, shown in the header. */
  permissionsHref?: string;
  /** Why the viewer can't open the permissions page; disables the button. */
  permissionsDenied?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [json, setJson] = useState(initialJson);
  const [valid, setValid] = useState(true);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  // Show the curated view first when we have one; JSON is the escape hatch.
  const [mode, setMode] = useState<"details" | "json">(
    details ? "details" : "json",
  );
  const showingJson = mode === "json" || !details;

  // What the current edit would change relative to the value on the server.
  // null when the edited JSON doesn't parse (Save is disabled in that case).
  const diff = useMemo(() => {
    try {
      return diffJson(JSON.parse(initialJson), JSON.parse(json));
    } catch {
      return null;
    }
  }, [initialJson, json]);

  function requestSave() {
    if (!onSave || !valid) return;
    if (!diff || diff.length === 0) {
      setStatus({ kind: "ok", text: "No changes to save." });
      return;
    }
    setStatus(null);
    setConfirmSave(true);
  }

  function save() {
    setConfirmSave(false);
    if (!onSave) return;
    startTransition(async () => {
      const res = await onSave(json);
      if ("ok" in res) {
        setStatus({ kind: "ok", text: "Saved." });
        router.refresh();
      } else {
        setStatus({ kind: "err", text: explain(res.error) });
      }
    });
  }

  function duplicate(newName: string) {
    if (!onDuplicate) return;
    setDupError(null);
    startTransition(async () => {
      // Copy the saved object, not any unsaved edits in the JSON editor.
      const res = await onDuplicate(newName, initialJson);
      if ("ok" in res) {
        setDuplicating(false);
        router.push(`${backHref}/${encodeURIComponent(newName)}`);
        router.refresh();
      } else {
        setDupError(explain(res.error));
      }
    });
  }

  function remove() {
    setConfirmDelete(false);
    if (!onDelete) return;
    setStatus(null);
    startTransition(async () => {
      const res = await onDelete();
      if ("ok" in res) {
        router.push(backHref);
        router.refresh();
      } else {
        setStatus({ kind: "err", text: explain(res.error) });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-link"
          >
            <span aria-hidden="true">←</span> Back
          </Link>
          <div className="flex items-center gap-2">
            {titleIcon}
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {permissionsHref && (
            <PermissionsButton href={permissionsHref} denied={permissionsDenied} />
          )}
          {details && (
            <Button
              variant="secondary"
              onClick={() => setMode(showingJson ? "details" : "json")}
            >
              {showingJson ? "View details" : readOnly ? "View JSON" : "Edit JSON"}
            </Button>
          )}
          {/* Duplicate is a create, so it's offered even in read-only views. */}
          {onDuplicate && (
            <Button
              variant="secondary"
              onClick={() => {
                setDupError(null);
                setDuplicating(true);
              }}
              disabled={pending}
            >
              Duplicate
            </Button>
          )}
          {/* Delete is allowed even in read-only views — you can't edit the
              JSON but you can still remove the object. */}
          {onDelete && (
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              Delete
            </Button>
          )}
          {!readOnly && onSave && showingJson && (
            <Button onClick={requestSave} disabled={pending || !valid}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>

      {status && (
        <p
          role="alert"
          className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-danger"}
        >
          {status.text}
        </p>
      )}

      {showingJson ? (
        <JsonEditor
          value={json}
          onChange={setJson}
          onValidityChange={setValid}
          readOnly={readOnly}
        />
      ) : (
        details
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${name}?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        This permanently deletes <span className="font-mono">{name}</span> from
        the server. This cannot be undone.
      </ConfirmDialog>

      {duplicating && (
        <PromptDialog
          open
          title={`Duplicate ${name}`}
          label="New name"
          confirmLabel="Duplicate"
          nameKind={nameKind}
          pending={pending}
          error={dupError}
          onSubmit={duplicate}
          onCancel={() => setDuplicating(false)}
        />
      )}

      <ConfirmDialog
        open={confirmSave}
        title="Apply changes?"
        confirmLabel="Apply"
        onConfirm={save}
        onCancel={() => setConfirmSave(false)}
      >
        <p className="mb-2">
          Review what will change on the server before saving:
        </p>
        {diff && <JsonDiffView lines={diff} />}
      </ConfirmDialog>
    </div>
  );
}
