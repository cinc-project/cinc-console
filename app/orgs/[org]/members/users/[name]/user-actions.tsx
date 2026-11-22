"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, type MenuItem } from "@/components/ui/action-menu";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import type { ActionResult } from "@/lib/cinc/action";
import { useRemoveUser } from "../../remove-user-button";

function explainDelete(error: string): string {
  if (error === "forbidden")
    return "Only the superuser or a server administrator can delete users.";
  if (error === "self") return "You can't delete your own user here.";
  if (error === "superuser") return "The superuser can't be deleted.";
  return error;
}

/**
 * The "⋯" menu in the user page header: remove from this org, and (when the
 * viewer can read the full record) delete the user from the whole server.
 * Deleting asks for the username, typed out, because it reaches every org.
 */
export function UserActions({
  org,
  name,
  admin,
  backHref,
  onRemove,
  onDelete,
}: {
  org: string;
  name: string;
  admin: boolean;
  backHref: string;
  onRemove: () => Promise<ActionResult>;
  /** Absent when the viewer can't delete this user. */
  onDelete?: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const remove = useRemoveUser({ username: name, admin, onRemove, redirectTo: backHref });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitDelete(value: string) {
    if (value !== name) {
      setDeleteError(`Type ${name} exactly to confirm.`);
      return;
    }
    if (!onDelete) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await onDelete();
      if ("ok" in res) {
        setDeleting(false);
        router.push(backHref);
      } else {
        setDeleteError(explainDelete(res.error));
      }
    });
  }

  const items: Array<MenuItem | "separator"> = [
    {
      label: `Remove from ${org}`,
      hint: "Keeps the user and their keys on the server",
      danger: true,
      disabled: remove.pending,
      onSelect: remove.start,
    },
  ];
  if (onDelete) {
    items.push("separator", {
      label: "Delete user from server",
      hint: "Removes them from every org and deletes their keys",
      danger: true,
      onSelect: () => {
        setDeleteError(null);
        setDeleting(true);
      },
    });
  }

  return (
    <>
      <ActionMenu label={`More actions for ${name}`} variant="secondary" items={items} />
      {remove.dialog}
      {deleting && (
        <PromptDialog
          open
          title={`Delete ${name} from the server?`}
          label={`This removes ${name} from every organization and deletes their keys. Type ${name} to confirm.`}
          confirmLabel="Delete user"
          pending={pending}
          error={deleteError}
          onSubmit={submitDelete}
          onCancel={() => setDeleting(false)}
        />
      )}
      {remove.error && (
        <p role="alert" className="basis-full text-right text-sm text-danger">
          {remove.error}
        </p>
      )}
    </>
  );
}
