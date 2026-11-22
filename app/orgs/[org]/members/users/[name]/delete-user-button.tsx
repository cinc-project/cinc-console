"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string): string {
  if (error === "forbidden")
    return "Only the superuser or a server administrator can delete users.";
  if (error === "self") return "You can't delete your own user here.";
  if (error === "superuser") return "The superuser can't be deleted.";
  return error;
}

/**
 * Deletes the user from the whole server. Asks for the username, typed out,
 * because it removes them from every org and deletes their keys.
 */
export function DeleteUserButton({
  name,
  backHref,
  onDelete,
}: {
  name: string;
  backHref: string;
  onDelete: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(value: string) {
    if (value !== name) {
      setError(`Type ${name} exactly to confirm.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await onDelete();
      if ("ok" in res) {
        setOpen(false);
        router.push(backHref);
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        className="text-danger hover:text-danger"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete user from server
      </Button>
      {open && (
        <PromptDialog
          open
          title={`Delete ${name} from the server?`}
          label={`This removes ${name} from every organization and deletes their keys. Type ${name} to confirm.`}
          confirmLabel="Delete user"
          pending={pending}
          error={error}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
