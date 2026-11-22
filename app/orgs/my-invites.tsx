"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionResult } from "@/lib/cinc/action";

/** One of the signed-in user's invitations plus its pre-bound answers. */
export type MyInviteItem = {
  orgname: string;
  onAccept: () => Promise<ActionResult>;
  onDecline: () => Promise<ActionResult>;
};

function explain(error: string): string {
  if (error === "not found") return "This invitation was withdrawn.";
  if (error === "forbidden")
    return "This invitation can no longer be accepted. Ask an admin of the organization to invite you again.";
  return error;
}

function InviteCard({ item }: { item: MyInviteItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function answer(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("ok" in res) router.refresh();
      else setError(explain(res.error));
    });
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="font-medium">
          You&apos;re invited to <span className="font-mono">{item.orgname}</span>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => answer(item.onAccept)}
          disabled={pending}
          aria-label={`Accept the invitation to ${item.orgname}`}
        >
          Accept
        </Button>
        <Button
          variant="secondary"
          onClick={() => answer(item.onDecline)}
          disabled={pending}
          aria-label={`Decline the invitation to ${item.orgname}`}
        >
          Decline
        </Button>
      </div>
    </Card>
  );
}

export function MyInvites({ items }: { items: MyInviteItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <InviteCard key={i.orgname} item={i} />
      ))}
    </div>
  );
}
