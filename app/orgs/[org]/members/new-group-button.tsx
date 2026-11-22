"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string): string {
  if (error === "forbidden") return "You don't have permission to create groups in this organization.";
  if (error === "already exists") return "A group with that name already exists.";
  if (error === "invalid name") return "Use only lowercase letters, numbers, _ and -.";
  return error;
}

/** Create an empty group, then open it to add members. */
export function NewGroupButton({
  basePath,
  onCreate,
}: {
  basePath: string;
  onCreate: (name: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(name: string) {
    setError(null);
    startTransition(async () => {
      const res = await onCreate(name);
      if ("ok" in res) {
        setOpen(false);
        router.push(`${basePath}/groups/${encodeURIComponent(name)}`);
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        New group
      </Button>
      {open && (
        <PromptDialog
          open
          title="New group"
          label="Group name"
          confirmLabel="Create group"
          nameKind="group"
          pending={pending}
          error={error}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
