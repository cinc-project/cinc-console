"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { revisionAnchor } from "@/components/revision-id";
import { DetailSection, EmptyState } from "./primitives";
import type { ActionResult } from "@/lib/cinc/action";

function explain(error: string): string {
  if (error === "forbidden")
    return "You don't have permission to delete policies in this organization.";
  return error;
}

/**
 * Policy revisions with delete controls: remove a single revision, or the whole
 * policy (all revisions) at once. Both go through a warning dialog since they're
 * irreversible. Deleting the last revision (or the whole policy) returns to the
 * list, where the policy no longer exists.
 *
 * `groups` maps a revision to the policy groups pinning it, so the page answers
 * "which revision is live where"; each row carries an id that group pages link
 * to.
 */
export function PolicyRevisions({
  org,
  name,
  revisions,
  groups = {},
  onDeleteRevision,
  onDeletePolicy,
}: {
  org: string;
  name: string;
  revisions: string[];
  groups?: Record<string, string[]>;
  onDeleteRevision: (revision: string) => Promise<ActionResult>;
  onDeletePolicy: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRevision, setConfirmRevision] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const sorted = [...revisions].sort().reverse();
  const listHref = `/orgs/${org}/policies`;

  function removeRevision(revision: string) {
    setConfirmRevision(null);
    setError(null);
    startTransition(async () => {
      const res = await onDeleteRevision(revision);
      if ("ok" in res) {
        if (revisions.length <= 1) router.push(listHref);
        else router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  function removePolicy() {
    setConfirmAll(false);
    setError(null);
    startTransition(async () => {
      const res = await onDeletePolicy();
      if ("ok" in res) {
        router.push(listHref);
        router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <DetailSection title="Revisions">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            {revisions.length} revision{revisions.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="danger"
            onClick={() => setConfirmAll(true)}
            disabled={pending || revisions.length === 0}
          >
            Delete policy
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {sorted.length === 0 ? (
          <EmptyState>No revisions.</EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {sorted.map((rev) => (
              <li
                key={rev}
                id={revisionAnchor(rev)}
                className="flex scroll-mt-4 flex-wrap items-center justify-between gap-2 px-3 py-1.5 target:bg-primary/10"
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="break-all font-mono text-sm text-text">{rev}</span>
                  {groups[rev] && groups[rev].length > 0 && (
                    <span className="flex flex-wrap items-baseline gap-1.5 text-xs text-muted">
                      Pinned in
                      {groups[rev].map((g) => (
                        <Link
                          key={g}
                          href={`/orgs/${org}/policy_groups/${encodeURIComponent(g)}`}
                          className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-success hover:underline"
                        >
                          {g}
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  disabled={pending}
                  onClick={() => setConfirmRevision(rev)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmRevision !== null}
        title={`Delete revision ${confirmRevision}?`}
        confirmLabel="Delete revision"
        confirmVariant="danger"
        onConfirm={() => confirmRevision && removeRevision(confirmRevision)}
        onCancel={() => setConfirmRevision(null)}
      >
        This permanently removes revision{" "}
        <span className="font-mono">{confirmRevision}</span> of{" "}
        <span className="font-mono">{name}</span> from the server. This cannot
        be undone.
        {confirmRevision && groups[confirmRevision]?.length ? (
          <>
            {" "}
            It is pinned in{" "}
            <span className="font-mono">{groups[confirmRevision].join(", ")}</span>,
            and nodes there can&apos;t fetch this policy until another revision
            is pushed.
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmAll}
        title={`Delete policy ${name}?`}
        confirmLabel={`Delete all ${revisions.length} revision${revisions.length === 1 ? "" : "s"}`}
        confirmVariant="danger"
        onConfirm={removePolicy}
        onCancel={() => setConfirmAll(false)}
      >
        This permanently deletes{" "}
        <strong>
          all {revisions.length} revision{revisions.length === 1 ? "" : "s"}
        </strong>{" "}
        of <span className="font-mono">{name}</span>. This cannot be undone.
      </ConfirmDialog>
    </DetailSection>
  );
}
