"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/cinc/action";

/** A pending invitation plus its pre-bound cancel action (created on the server). */
export type InviteItem = { username: string; onCancel: () => Promise<ActionResult> };

function explain(error: string): string {
  if (error === "forbidden")
    return "You don't have permission to cancel invitations in this organization.";
  if (error === "not found") return "This invitation was already accepted or withdrawn.";
  return error;
}

function CancelInviteButton({ item }: { item: InviteItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await item.onCancel();
      if ("ok" in res) router.refresh();
      else setError(explain(res.error));
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="text-danger hover:text-danger"
        aria-label={`Cancel invitation for ${item.username}`}
      >
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Cancel the invitation for ${item.username}?`}
        confirmLabel="Cancel invitation"
        confirmVariant="danger"
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
      >
        <span className="font-mono">{item.username}</span> won&apos;t be able
        to accept it. You can invite them again later.
      </ConfirmDialog>
    </div>
  );
}

/** Invitations sent from this org that haven't been answered yet. */
export function PendingInvites({ items }: { items: InviteItem[] }) {
  const sorted = [...items].sort((a, b) => a.username.localeCompare(b.username));
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Pending invitations</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th scope="col" className="px-4 py-2 font-medium">
              Username
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((i) => (
            <tr key={i.username} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-text">{i.username}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end">
                  <CancelInviteButton item={i} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
