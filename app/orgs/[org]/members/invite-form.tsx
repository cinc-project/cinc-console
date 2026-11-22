"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string, name: string): string {
  if (error === "forbidden")
    return "You don't have permission to invite users in this organization.";
  if (error === "not found") return `There's no user named ${name} on this server.`;
  if (error === "already exists")
    return `${name} is already a member or already has a pending invitation.`;
  return error;
}

export function InviteForm({
  onInvite,
}: {
  onInvite: (username: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const name = username.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await onInvite(name);
      if ("ok" in res) {
        setUsername("");
        // An invitation, not a membership: the user joins when they accept it.
        setSuccess(`Invited ${name}. They'll join once they accept the invitation.`);
        router.refresh();
      } else {
        setError(explain(res.error, name));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md items-start gap-2">
      <div className="flex-1 space-y-1">
        <Input
          aria-label="Username to invite"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-success">
            {success}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending || !username.trim()}>
        {pending ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}
