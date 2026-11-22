"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string, username: string): string {
  if (error === "forbidden")
    return "You don't have permission to remove users in this organization.";
  if (error === "last admin")
    return `${username} is the organization's only admin. Make someone else an admin first.`;
  if (error === "nested admin")
    return `${username} is an admin through a group inside admins. Remove them from that group first.`;
  return error;
}

type RemoveUserOptions = {
  username: string;
  /** A direct member of admins: removal takes them out of admins first. */
  admin?: boolean;
  onRemove: () => Promise<ActionResult>;
  /** Where to go afterwards, when the current page is about this user. */
  redirectTo?: string;
};

/**
 * Removing a user from the org: `start()` asks for confirmation, `dialog` is
 * the confirmation to render, `error` explains a refusal. Shared by the list's
 * Remove button and the user page's actions menu.
 */
export function useRemoveUser({ username, admin = false, onRemove, redirectTo }: RemoveUserOptions) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await onRemove();
      if ("ok" in res) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        setError(explain(res.error, username));
      }
    });
  }

  const dialog = (
    <ConfirmDialog
      open={confirming}
      title={`Remove ${username}?`}
      confirmLabel="Remove"
      confirmVariant="danger"
      onConfirm={remove}
      onCancel={() => setConfirming(false)}
    >
      This removes <span className="font-mono">{username}</span> from this
      organization{admin ? ", after first removing them from the admins group" : ""}.
      They can be invited back later.
    </ConfirmDialog>
  );

  return { start: () => setConfirming(true), pending, error, dialog };
}

export function RemoveUserButton({
  label = "Remove",
  ...options
}: RemoveUserOptions & { label?: string }) {
  const { start, pending, error, dialog } = useRemoveUser(options);
  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        onClick={start}
        disabled={pending}
        className="text-danger hover:text-danger"
      >
        {pending ? "Removing…" : label}
      </Button>
      {dialog}
    </div>
  );
}
