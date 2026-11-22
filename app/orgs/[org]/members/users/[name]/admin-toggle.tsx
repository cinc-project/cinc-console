"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string, name: string): string {
  if (error === "forbidden") return "You don't have permission to change the admins group.";
  if (error === "last admin")
    return `${name} is the organization's only admin. Make someone else an admin first.`;
  if (error === "not found") return `The server didn't add ${name} to admins.`;
  return error;
}

/** Shows the user's role and adds them to, or removes them from, admins. */
export function AdminToggle({
  name,
  admin,
  onChange,
}: {
  name: string;
  admin: boolean;
  onChange: (admin: boolean) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await onChange(!admin);
      if ("ok" in res) router.refresh();
      else setError(explain(res.error, name));
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-text">
        Role: <strong>{admin ? "Admin" : "Member"}</strong>
        <span className="text-muted">
          {admin
            ? " (in the admins group: manages members, groups and permissions)"
            : " (in the users group)"}
        </span>
      </p>
      <Button variant="secondary" disabled={pending} onClick={() => setConfirming(true)}>
        {admin ? "Remove admin" : "Make admin"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={admin ? `Remove ${name} from admins?` : `Make ${name} an admin?`}
        confirmLabel={admin ? "Remove admin" : "Make admin"}
        confirmVariant={admin ? "danger" : "primary"}
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      >
        {admin
          ? `${name} stays a member but can no longer manage this organization.`
          : `${name} will be able to manage this organization's members, groups and permissions.`}
      </ConfirmDialog>
    </div>
  );
}
