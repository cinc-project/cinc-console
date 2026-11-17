"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { JsonEditor } from "@/components/json-editor";
import { JsonDiffView } from "@/components/json-diff-view";
import { diffJson } from "@/lib/json-diff";
import type { ActionResult } from "@/lib/cinc/action";

/**
 * Raw JSON tab: the full node object, read-only until Edit. Saving shows the
 * diff against the server's copy before applying, like every other editor.
 */
export function NodeJsonPanel({
  name,
  initialJson,
  onSave,
}: {
  name: string;
  initialJson: string;
  onSave: (json: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState(initialJson);
  const [valid, setValid] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const diff = useMemo(() => {
    try {
      return diffJson(JSON.parse(initialJson), JSON.parse(json));
    } catch {
      return null;
    }
  }, [initialJson, json]);

  function download() {
    const url = URL.createObjectURL(new Blob([initialJson], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function requestSave() {
    if (!valid) return;
    if (!diff || diff.length === 0) {
      setStatus({ kind: "ok", text: "No changes to save." });
      return;
    }
    setStatus(null);
    setConfirm(true);
  }

  function save() {
    setConfirm(false);
    startTransition(async () => {
      const res = await onSave(json);
      if ("ok" in res) {
        setStatus({ kind: "ok", text: "Saved." });
        setEditing(false);
        router.refresh();
      } else {
        setStatus({
          kind: "err",
          text: res.error === "forbidden" ? "You don't have permission to do that in this organization." : res.error,
        });
      }
    });
  }

  function cancel() {
    setJson(initialJson);
    setValid(true);
    setStatus(null);
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {editing
            ? "Editing the full node object. automatic is overwritten by the client on its next run."
            : "The full node object as stored on the server."}
        </p>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={requestSave} disabled={pending || !valid}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={download}>
                Download {name}.json
              </Button>
              <Button
                onClick={() => {
                  // Start from the server's current copy (it changes after a save).
                  setJson(initialJson);
                  setValid(true);
                  setStatus(null);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {status && (
        <p
          role={status.kind === "ok" ? "status" : "alert"}
          className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-danger"}
        >
          {status.text}
        </p>
      )}

      <JsonEditor
        value={editing ? json : initialJson}
        onChange={setJson}
        onValidityChange={setValid}
        readOnly={!editing}
        rows={32}
      />

      <ConfirmDialog
        open={confirm}
        title="Apply changes?"
        confirmLabel="Apply"
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      >
        <p className="mb-2">Review what will change on the server before saving:</p>
        {diff && <JsonDiffView lines={diff} />}
      </ConfirmDialog>
    </div>
  );
}
