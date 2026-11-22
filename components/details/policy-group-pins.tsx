"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RevisionId, revisionHref } from "@/components/revision-id";
import { DetailSection, EmptyState } from "./primitives";
import type { ActionResult } from "@/lib/cinc/action";
import type { PolicyPin } from "@/lib/cinc/policy-groups";

function explain(error: string): string {
  if (error === "forbidden")
    return "You don't have permission to change this policy group.";
  return error;
}

/**
 * The policies pinned in a group, each linking to its policy and to the pinned
 * revision, with delete controls: unpin one policy, or delete the whole group.
 * Pinning a revision is a push from the workstation, not something done here.
 */
export function PolicyGroupPins({
  org,
  group,
  pins,
  onRemovePolicy,
  onDeleteGroup,
}: {
  org: string;
  group: string;
  pins: PolicyPin[];
  onRemovePolicy: (policy: string) => Promise<ActionResult>;
  onDeleteGroup: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmPolicy, setConfirmPolicy] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState(false);
  const listHref = `/orgs/${org}/policy_groups`;

  function removePolicy(policy: string) {
    setConfirmPolicy(null);
    setError(null);
    startTransition(async () => {
      const res = await onRemovePolicy(policy);
      if ("ok" in res) router.refresh();
      else setError(explain(res.error));
    });
  }

  function removeGroup() {
    setConfirmGroup(false);
    setError(null);
    startTransition(async () => {
      const res = await onDeleteGroup();
      if ("ok" in res) {
        router.push(listHref);
        router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <DetailSection title="Pinned policies">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">
            {pins.length} polic{pins.length === 1 ? "y" : "ies"}
          </span>
          <Button
            variant="danger"
            onClick={() => setConfirmGroup(true)}
            disabled={pending}
          >
            Delete group
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {pins.length === 0 ? (
          <EmptyState>
            No policies are pinned in this group. Push a policy to{" "}
            <span className="font-mono">{group}</span> from your workstation to
            pin one.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {pins.map((p) => (
              <li
                key={p.policy}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5"
              >
                <span className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <Link
                    href={`/orgs/${org}/policies/${encodeURIComponent(p.policy)}`}
                    className="font-mono text-text hover:text-link"
                  >
                    {p.policy}
                  </Link>
                  <Link
                    href={revisionHref(org, p.policy, p.revision)}
                    className="text-muted hover:text-link"
                  >
                    <span className="sr-only">{p.policy}</span>{" "}
                    revision <RevisionId revision={p.revision} />
                  </Link>
                </span>
                <Button
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  disabled={pending}
                  aria-label={`Remove ${p.policy} from ${group}`}
                  onClick={() => setConfirmPolicy(p.policy)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmPolicy !== null}
        title={`Remove ${confirmPolicy} from ${group}?`}
        confirmLabel="Remove from group"
        confirmVariant="danger"
        onConfirm={() => confirmPolicy && removePolicy(confirmPolicy)}
        onCancel={() => setConfirmPolicy(null)}
      >
        Nodes in <span className="font-mono">{group}</span> that run{" "}
        <span className="font-mono">{confirmPolicy}</span> can&apos;t fetch it
        until a revision is pushed to the group again. The policy and its
        revisions are kept.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmGroup}
        title={`Delete policy group ${group}?`}
        confirmLabel="Delete group"
        confirmVariant="danger"
        onConfirm={removeGroup}
        onCancel={() => setConfirmGroup(false)}
      >
        This deletes <span className="font-mono">{group}</span>
        {pins.length > 0 &&
          ` and unpins ${pins.length === 1 ? "its policy" : `all ${pins.length} of its policies`}`}
        . Nodes in the group can&apos;t fetch a policy until one is pushed to it
        again. Policies and their revisions are kept.
      </ConfirmDialog>
    </DetailSection>
  );
}
