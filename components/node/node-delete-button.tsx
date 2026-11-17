"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/cinc/action";

/** Delete with a confirm dialog; returns to the node list on success. */
export function NodeDeleteButton({
  name,
  listHref,
  onDelete,
}: {
  name: string;
  listHref: string;
  onDelete: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await onDelete();
      if ("ok" in res) {
        router.push(listHref);
        router.refresh();
      } else {
        setError(
          res.error === "forbidden"
            ? "You don't have permission to delete this node."
            : res.error,
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        className="flex-1 border-danger/40 text-danger hover:border-danger"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-sm text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      >
        This permanently deletes <span className="font-mono">{name}</span> from
        the server. The client will re-register on its next run only if it still
        has a valid key. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
