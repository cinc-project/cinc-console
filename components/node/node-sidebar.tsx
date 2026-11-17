import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformIcon } from "@/components/platform/platform-icon";
import { buttonClass } from "@/components/ui/button";
import { formatUptime, osName, type NodeFacts } from "@/lib/cinc/node-facts";
import type { ClientStatus } from "@/lib/cinc/fleet";
import type { OsSupport } from "@/lib/cinc/os-lifecycle";
import { checkInLine, clientLine, configLine, osLine, type StatusLine } from "./node-status";
import { StatusItem } from "./parts";

/**
 * The node's identity card: what it is, the four health answers (checking in?
 * client supported? configured? OS supported?), the facts people copy most,
 * and the destructive action. Stays put while the tabs change.
 */
export function NodeSidebar({
  org,
  name,
  base,
  facts,
  now,
  clientStatus,
  latestMajor,
  os,
  deleteButton,
}: {
  org: string;
  name: string;
  base: string;
  facts: NodeFacts;
  now: number;
  clientStatus: ClientStatus;
  latestMajor: number | null;
  os: OsSupport;
  /** The client-side delete control (needs the bound server action). */
  deleteButton: ReactNode;
}) {
  const lines = [
    checkInLine(facts, now),
    clientLine(facts, clientStatus, latestMajor),
    configLine(facts),
    osLine(os),
  ].filter((l): l is StatusLine => l !== null);

  const subtitle = [osName(facts), facts.arch].filter(Boolean).join(" · ");
  const needsRunList = !facts.policyName && facts.runList.length === 0;

  return (
    <aside
      aria-label="Node summary"
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)] lg:w-80 lg:shrink-0"
    >
      <div className="space-y-4 border-b border-border p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-surface-2">
          <PlatformIcon platform={facts.platform} className="h-9 w-9 text-text" />
        </div>
        <div className="space-y-1">
          <h1 className="break-all font-mono text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-muted">{subtitle || "Platform not reported yet"}</p>
        </div>
        <ul aria-label="Health" className="space-y-2 text-sm">
          {lines.map((l) => (
            <StatusItem key={l.text} line={l} />
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-6 py-5 text-sm">
        <dt className="text-muted">Environment</dt>
        <dd>
          {facts.environment ? (
            <Link
              href={`/orgs/${org}/environments/${encodeURIComponent(facts.environment)}`}
              className="font-mono hover:underline"
            >
              {facts.environment}
            </Link>
          ) : (
            <span className="text-muted">—</span>
          )}
        </dd>
        <dt className="text-muted">IP address</dt>
        <dd className="break-all font-mono">{facts.ipaddress ?? <span className="text-muted">—</span>}</dd>
        <dt className="text-muted">FQDN</dt>
        <dd className="break-all font-mono">{facts.fqdn ?? <span className="text-muted">—</span>}</dd>
        <dt className="text-muted">Uptime</dt>
        <dd>
          {facts.uptimeSeconds !== null ? formatUptime(facts.uptimeSeconds) : <span className="text-muted">—</span>}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2 px-6 pb-6">
        {needsRunList && (
          <Link href={`${base}/run-list`} className={buttonClass("primary", "flex-1")}>
            Set run list
          </Link>
        )}
        {deleteButton}
      </div>
    </aside>
  );
}
