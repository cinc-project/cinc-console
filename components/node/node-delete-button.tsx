"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/cinc/action";
import type { ClientKeptReason } from "@/lib/node-delete";

type DeleteResult = ActionResult | { error: string; clientKept: ClientKeptReason };

/**
 * Delete with a confirm dialog; returns to the node list on success. When a
 * client of the same name exists (`pairedClient`), the dialog offers to delete
 * it too, checked by default: decommissioning a node normally removes both,
 * and a leftover client's key still authenticates.
 */
export function NodeDeleteButton({
  name,
  listHref,
  pairedClient = null,
  onDelete,
}: {
  name: string;
  listHref: string;
  pairedClient?: "deletable" | "forbidden" | null;
  onDelete: (alsoDeleteClient: boolean) => Promise<DeleteResult>;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [withClient, setWithClient] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setOpen(false);
    setError(null);
    const alsoDeleteClient = pairedClient === "deletable" && withClient;
    startTransition(async () => {
      const res = await onDelete(alsoDeleteClient);
      if ("ok" in res) {
        router.push(listHref);
        router.refresh();
      } else if ("clientKept" in res) {
        // The node is gone and so is this page; the list explains the rest.
        const q = new URLSearchParams({ deleted: name, client_kept: res.clientKept });
        router.push(`${listHref}?${q}`);
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

  const controls =
    pairedClient === "deletable" ? (
      <div className="flex items-start gap-2">
        <input
          id={`${id}-client`}
          type="checkbox"
          className="mt-1"
          checked={withClient}
          onChange={(e) => setWithClient(e.target.checked)}
          aria-describedby={`${id}-client-hint`}
        />
        <div>
          <label htmlFor={`${id}-client`} className="text-text">
            Also delete client <span className="font-mono">{name}</span>
          </label>
          <p id={`${id}-client-hint`} className="text-muted">
            Its key can still authenticate to the server until it is deleted.
          </p>
        </div>
      </div>
    ) : pairedClient === "forbidden" ? (
      <p className="text-muted">
        A client named <span className="font-mono">{name}</span> may also exist,
        but you don&apos;t have permission to view it, so it can&apos;t be
        deleted here.
      </p>
    ) : null;

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
        controls={controls}
      >
        This permanently deletes <span className="font-mono">{name}</span> from
        the server. The client will re-register on its next run only if it still
        has a valid key. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
