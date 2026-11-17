"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/cinc/action";

/**
 * Move the node to another environment. `options` is null when the user can't
 * list environments; the current one is then shown read-only rather than
 * offering a choice the server would refuse.
 */
export function EnvironmentPicker({
  current,
  options,
  onSave,
}: {
  current: string | null;
  options: string[] | null;
  onSave: (environment: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const id = useId();
  const initial = current ?? "_default";
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!options) {
    return (
      <p className="text-sm">
        <span className="font-mono">{initial}</span>{" "}
        <span className="text-muted">(you can&apos;t list environments in this organization)</span>
      </p>
    );
  }

  const choices = options.includes(initial) ? options : [initial, ...options];

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await onSave(value);
      if ("ok" in res) {
        setStatus({ kind: "ok", text: `Moved to ${value}.` });
        router.refresh();
      } else {
        setStatus({
          kind: "err",
          text: res.error === "forbidden" ? "You don't have permission to edit this node." : res.error,
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm text-muted">
            Environment
          </label>
          <select
            id={id}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
            disabled={pending}
            className="h-10 min-w-56 rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {choices.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={save} disabled={pending || value === initial}>
          {pending ? "Saving…" : "Move node"}
        </Button>
      </div>
      {status && (
        <p
          role={status.kind === "ok" ? "status" : "alert"}
          className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-danger"}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
