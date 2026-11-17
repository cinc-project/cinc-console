import Link from "next/link";
import { relativeAgo } from "@/lib/time";
import type { ClientLifecycle, ClientStatus } from "@/lib/cinc/fleet";
import {
  formatKb,
  formatUptime,
  machineKind,
  osName,
  unconfigured,
  type NodeFacts,
} from "@/lib/cinc/node-facts";
import { IconWarning } from "@/components/ui/icons";
import { Chips, RunList } from "@/components/details/primitives";
import { NodeSection, NotReported, Stat, UsageBar } from "./parts";

function utc(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function clientSub(status: ClientStatus, lifecycle: ClientLifecycle): string | null {
  if (status === "eol") return "End-of-life release";
  if (status === "major-behind")
    return lifecycle.latestVersion ? `${lifecycle.latestVersion} available` : "Newer major available";
  if (status === "current") return "Current release";
  return null;
}

/** Overview tab: is it alive, what does it run, and what is it — at a glance. */
export function NodeOverview({
  org,
  base,
  facts,
  now,
  clientStatus,
  lifecycle,
}: {
  org: string;
  base: string;
  facts: NodeFacts;
  now: number;
  clientStatus: ClientStatus;
  lifecycle: ClientLifecycle;
}) {
  const lastMs = facts.ohaiTime !== null ? facts.ohaiTime * 1000 : null;
  const reasons = unconfigured(facts);
  const isUnconfigured = !facts.policyName && (reasons.emptyRunList || reasons.defaultEnv);
  const kind = machineKind(facts);
  const disks = [...facts.filesystems].sort((a, b) => b.kbSize - a.kbSize).slice(0, 3);
  const primary = facts.interfaces[0];

  return (
    <div className="space-y-5">
      <NodeSection
        title="Client activity"
        action={<span className="text-xs text-muted">Missing after 12 h without a check-in</span>}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
          <Stat
            label="Last check-in"
            value={lastMs !== null ? relativeAgo(now - lastMs) : "Never"}
            sub={lastMs !== null ? <time dateTime={new Date(lastMs).toISOString()}>{utc(lastMs)}</time> : "Waiting for the first run"}
          />
          <Stat
            label="Cinc Client"
            value={facts.clientVersion ?? "—"}
            mono={facts.clientVersion !== null}
            sub={clientSub(clientStatus, lifecycle)}
          />
          <Stat
            label="Host uptime"
            value={facts.uptimeSeconds !== null ? formatUptime(facts.uptimeSeconds) : "—"}
          />
        </div>
      </NodeSection>

      <NodeSection
        title="What it runs"
        action={
          <Link href={`${base}/run-list`} className="text-sm">
            {facts.policyName ? "View tags" : "Edit run list & tags"}
          </Link>
        }
      >
        {isUnconfigured && (
          <div role="note" className="flex gap-3 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
            <span aria-hidden="true" className="mt-0.5 text-warn">
              <IconWarning />
            </span>
            <div className="space-y-1">
              <p className="font-semibold">This node is registered but not fully managed.</p>
              <p className="text-muted">
                {reasons.emptyRunList && reasons.defaultEnv
                  ? "It has an empty run list and sits in _default, so the client checks in but applies no configuration."
                  : reasons.emptyRunList
                    ? "Its run list is empty, so the client checks in but applies no configuration."
                    : "It sits in _default, so it gets no environment cookbook pins or attributes."}
              </p>
            </div>
          </div>
        )}
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          {facts.policyName ? (
            <>
              <dt className="text-muted">Policy</dt>
              <dd className="font-mono">{facts.policyName}</dd>
              <dt className="text-muted">Policy group</dt>
              <dd className="font-mono">{facts.policyGroup ?? "—"}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted">Environment</dt>
              <dd>
                {facts.environment ? (
                  <Link
                    href={`/orgs/${org}/environments/${encodeURIComponent(facts.environment)}`}
                    className="font-mono"
                  >
                    {facts.environment}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted">Run list</dt>
              <dd>
                <RunList items={facts.runList} />
              </dd>
            </>
          )}
          <dt className="text-muted">Tags</dt>
          <dd>
            <Chips items={facts.tags} empty="None." />
          </dd>
        </dl>
      </NodeSection>

      <NodeSection
        title="System"
        action={
          <Link href={`${base}/hardware`} className="text-sm">
            All hardware details
          </Link>
        }
      >
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-6 gap-y-4 text-sm">
          <div className="space-y-1">
            <dt className="text-xs text-muted">Operating system</dt>
            <dd>{osName(facts) ?? <NotReported />}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted">Kernel</dt>
            <dd className="font-mono">
              {facts.kernelRelease ? [facts.kernelName, facts.kernelRelease, facts.arch].filter(Boolean).join(" ") : <NotReported />}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted">Machine</dt>
            <dd>{kind ?? <NotReported />}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted">CPU</dt>
            <dd>
              {facts.cpu?.model || facts.cpu?.threads ? (
                [facts.cpu.model, facts.cpu.threads ? `${facts.cpu.threads} threads` : null].filter(Boolean).join(" · ")
              ) : (
                <NotReported />
              )}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted">
              Memory
              {facts.memory?.usedKb != null && ` · ${formatKb(facts.memory.usedKb)} of ${formatKb(facts.memory.totalKb)}`}
            </dt>
            <dd>
              {facts.memory?.usedKb != null ? (
                <UsageBar percent={(facts.memory.usedKb / facts.memory.totalKb) * 100} label="Memory used" />
              ) : facts.memory ? (
                formatKb(facts.memory.totalKb)
              ) : (
                <NotReported />
              )}
            </dd>
          </div>
          {disks.map((d) => (
            <div key={d.mount} className="space-y-1">
              <dt className="text-xs text-muted">
                <span className="font-mono">{d.mount}</span> · {formatKb(d.kbSize)}
              </dt>
              <dd>
                {d.percentUsed !== null ? (
                  <UsageBar percent={d.percentUsed} label={`${d.mount} used`} />
                ) : (
                  <NotReported />
                )}
              </dd>
            </div>
          ))}
          <div className="space-y-1">
            <dt className="text-xs text-muted">Primary interface</dt>
            <dd className="font-mono">
              {primary ? (
                [primary.name, primary.addresses.find((a) => a.family === "inet")?.address].filter(Boolean).join(" ")
              ) : (
                <NotReported />
              )}
            </dd>
          </div>
        </dl>
      </NodeSection>
    </div>
  );
}
