"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PermissionsButton } from "@/components/permissions-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailRow, DetailSheet } from "@/components/ui/detail-rows";
import { Badge } from "@/components/details/primitives";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string): string {
  if (error === "forbidden") return "You don't have permission to delete this client.";
  return error;
}

/**
 * Title, flags and actions of a client page, then its rows in a sheet. The
 * menu's View JSON adds a JSON row at the top of the sheet.
 */
export function ClientHeader({
  name,
  json,
  validator,
  admin,
  backHref,
  permissionsHref,
  permissionsDenied,
  onDelete,
  children,
}: {
  name: string;
  json: string;
  validator: boolean;
  admin: boolean;
  backHref: string;
  permissionsHref: string;
  /** Why the viewer can't open the permissions page; disables the button. */
  permissionsDenied?: string;
  onDelete: () => Promise<ActionResult>;
  /** The page's rows, rendered on the server. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [showJson, setShowJson] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await onDelete();
      if ("ok" in res) {
        router.push(backHref); // nosemgrep: js-express-xss
        router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  const jsonRow = showJson && (
    <DetailRow label="JSON">
      <pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-muted">{json}</pre>
    </DetailRow>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="break-words font-mono text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={validator ? "warn" : "muted"}>{validator ? "Validator" : "Client"}</Badge>
            {admin && <Badge tone="primary">Admin</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PermissionsButton href={permissionsHref} denied={permissionsDenied} />
          <ActionMenu
            label={`More actions for ${name}`}
            variant="secondary"
            items={[
              { label: showJson ? "Hide JSON" : "View JSON", onSelect: () => setShowJson((s) => !s) },
              "separator",
              {
                label: "Delete client",
                hint: validator
                  ? "Bootstrapping with its key stops working"
                  : "Anything signing as it stops working",
                danger: true,
                disabled: pending,
                onSelect: () => setConfirming(true),
              },
            ]}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <DetailSheet>
        {jsonRow}
        {children}
      </DetailSheet>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${name}?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        This permanently deletes <span className="font-mono">{name}</span> and its keys
        from the server. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
