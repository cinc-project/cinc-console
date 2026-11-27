"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { IconCheck } from "@/components/ui/icons";
import type { CheckIn } from "./actions";

export type CheckInState = "waiting" | "registered" | "checked-in";

const FIRST_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30_000;
const GIVE_UP_AFTER_MS = 30 * 60_000;

/**
 * Polls for a bootstrapping node until its first run finishes: right away,
 * then every 5s backing off by 1.5x to 30s, giving up after 30 minutes. A
 * failed poll (e.g. a 403 on reading nodes) is shown and stops the polling.
 */
export function CheckInStatus({
  org,
  name,
  check,
  onState,
}: {
  org: string;
  name: string;
  check: (name: string) => Promise<CheckIn>;
  onState?: (state: CheckInState) => void;
}) {
  const [result, setResult] = useState<CheckIn>({ state: "waiting" });
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    let delay = FIRST_DELAY_MS;

    async function poll() {
      let res: CheckIn;
      try {
        res = await check(name);
      } catch {
        res = { error: "unavailable" };
      }
      if (cancelled) return;
      setResult(res);
      if ("state" in res) onState?.(res.state);
      if ("error" in res || res.state === "checked-in") return;
      if (Date.now() - started >= GIVE_UP_AFTER_MS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(poll, delay);
      delay = Math.min(MAX_DELAY_MS, delay * 1.5);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [check, name, onState]);

  if ("error" in result) {
    return (
      <p role="status" className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted">
        {result.error === "forbidden"
          ? "You can't read nodes here, so this page can't watch for the check-in."
          : "Couldn't check on the node. It will appear under Nodes when it checks in."}
      </p>
    );
  }

  if (result.state === "checked-in") {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm"
      >
        <span aria-hidden="true" className="text-success">
          <IconCheck />
        </span>
        <span>
          <span className="font-mono">{name}</span> checked in
          {result.platform ? <> · {result.platform}</> : null}
        </span>
        <Link
          href={`/orgs/${org}/nodes/${encodeURIComponent(name)}`}
          className={buttonClass("primary", "ml-auto")}
        >
          Open node
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3 text-sm"
    >
      {!gaveUp && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-link border-t-transparent motion-reduce:animate-none"
        />
      )}
      <span>
        {gaveUp ? (
          <>Still waiting. It will appear under Nodes when it checks in.</>
        ) : result.state === "registered" ? (
          <>
            <span className="font-mono">{name}</span> registered, first run in progress…
          </>
        ) : (
          <>
            Watching for <span className="font-mono">{name}</span> to check in. You can leave
            this page.
          </>
        )}
      </span>
    </div>
  );
}
