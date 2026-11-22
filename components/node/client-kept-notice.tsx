import Link from "next/link";
import { IconWarning } from "@/components/ui/icons";
import { nameError } from "@/lib/cinc/names";
import { clientKeptMessage, parseClientKept } from "@/lib/node-delete";

/**
 * Shown on the node list after a node was deleted but its client wasn't. The
 * node page is gone by then, so the outcome travels in the URL as a reason
 * code; the wording is built here, so a crafted link can't inject prose.
 */
export function ClientKeptNotice({
  org,
  deleted,
  reason,
}: {
  org: string;
  deleted: unknown;
  reason: unknown;
}) {
  const kept = parseClientKept(reason);
  if (!kept || typeof deleted !== "string" || !deleted || nameError("node", deleted)) {
    return null;
  }
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-md border border-warn/50 bg-warn/10 p-3 text-sm text-text"
    >
      <IconWarning />
      <p>
        {clientKeptMessage(deleted, kept)}{" "}
        <Link
          href={`/orgs/${org}/clients/${encodeURIComponent(deleted)}`}
          className="underline"
        >
          View client {deleted}
        </Link>
      </p>
    </div>
  );
}
