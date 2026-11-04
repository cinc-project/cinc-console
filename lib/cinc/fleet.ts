// Pure fleet-status logic for the org dashboard: classify nodes and roll them
// up into the stat-tile counts (recent / missing / unconfigured / outdated),
// the last-check-in histogram, and a per-node summary list. No I/O and no `server-only` import on purpose —
// this is the unit-tested core; `search.ts` does the actual fetching and feeds
// these functions the parsed rows.

/** A node reduced to just the fields the dashboard reasons about. */
export type FleetNode = {
  name: string;
  /** ohai_time: unix seconds of the node's last check-in, or null if never. */
  ohaiTime: number | null;
  runList: string[];
  policyName: string | null;
  policyGroup: string | null;
  /** chef_packages.chef.version reported by the client, or null if unknown. */
  chefVersion: string | null;
  /** chef_environment, or null if the search returned none. */
  environment: string | null;
  /** automatic.platform / platform_version from ohai; null before the first run. */
  platform: string | null;
  platformVersion: string | null;
};

export type NodeStatus = "ok" | "missing" | "unconfigured";

/**
 * Client-version standing, measured against the Cinc/Chef Infra Client release
 * lifecycle (see ClientLifecycle):
 *   - current      on the latest GA major (and not EOL)
 *   - major-behind ≥1 major release behind the latest GA major
 *   - eol          on a major that has reached end-of-life
 *   - unknown      no version reported (never converged)
 */
export type ClientStatus = "current" | "major-behind" | "eol" | "unknown";

/**
 * Release-lifecycle facts the Infra Server can't know — sourced from
 * endoflife.date. Passed into the pure logic so classification stays testable.
 */
export type ClientLifecycle = {
  /** Highest GA major known, or null if the lifecycle source was unavailable. */
  latestMajor: number | null;
  /** Latest released version string, for display (e.g. "19.3.15"). */
  latestVersion: string | null;
  /** Majors that have reached end-of-life. */
  eolMajors: number[];
};

/** One row in the live node list below the stat tiles. */
export type NodeSummary = {
  name: string;
  status: NodeStatus;
  /**
   * Independent diagnostic flags mirroring the stat tiles. `status` collapses to
   * one badge by priority (missing wins), but a node can be counted by more than
   * one tile — so tile filtering keys off these flags, not the single-valued
   * badge, to select exactly the nodes the tile counted.
   */
  missing: boolean;
  unconfigured: boolean;
  /** Why it's unconfigured — either or both can be set. */
  emptyRunList: boolean;
  defaultEnv: boolean;
  /** Checked in within RECENT_WITHIN_MS. */
  recent: boolean;
  lastCheckIn: number | null;
  chefVersion: string | null;
  clientStatus: ClientStatus;
  environment: string | null;
  platform: string | null;
  platformVersion: string | null;
};

export type FleetStats = {
  total: number;
  /** Checked in within RECENT_WITHIN_MS. */
  recent: number;
  missing: number;
  /** Never checked in (a subset of missing). */
  never: number;
  unconfigured: number;
  /** Unconfigured breakdown; a node with both reasons counts in each. */
  emptyRunList: number;
  defaultEnv: number;
  /** Node count per CHECKIN_BUCKETS entry, same order. */
  checkIns: number[];
  /** Clients needing an upgrade = eol + majorBehind. */
  outdated: number;
  eol: number;
  majorBehind: number;
  /** Latest GA major used as the bar, for the tile's subtext. */
  latestMajor: number | null;
  latestVersion: string | null;
};

export type FleetSnapshot = {
  stats: FleetStats;
  nodes: NodeSummary[];
  /** Unix ms when the snapshot was built, so the UI can show "updated Ns ago". */
  generatedAt: number;
};

/**
 * How long since a node's last check-in before we call it "missing". Chef
 * clients running as a daemon converge every ~30 min; 12h is comfortably past
 * any normal interval (including hourly/cron schedules) without flagging a node
 * that simply slept through one run.
 */
export const MISSING_AFTER_MS = 12 * 60 * 60 * 1000;

/** "Checked in lately" for the first stat tile: within the last hour. */
export const RECENT_WITHIN_MS = 60 * 60 * 1000;

/** The environment every node lands in unless someone assigns one. */
export const DEFAULT_ENVIRONMENT = "_default";

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

/**
 * Last-check-in histogram buckets, oldest last. `maxMs` is an inclusive upper
 * bound on time since check-in; the 6–12h / 12h–7d boundary is exactly
 * MISSING_AFTER_MS, so the "missing" line on the chart falls between two bars
 * and every bar is either wholly present or wholly missing. `null` maxMs is the
 * never-checked-in bucket.
 */
export const CHECKIN_BUCKETS: ReadonlyArray<{
  /** Short axis label. */
  label: string;
  /** Spoken form for screen readers ("<30m" reads badly). */
  description: string;
  maxMs: number | null;
  missing: boolean;
}> = [
  { label: "<30m", description: "under 30 minutes ago", maxMs: 30 * MIN_MS, missing: false },
  { label: "30m–1h", description: "30 minutes to 1 hour ago", maxMs: HOUR_MS, missing: false },
  { label: "1–6h", description: "1 to 6 hours ago", maxMs: 6 * HOUR_MS, missing: false },
  { label: "6–12h", description: "6 to 12 hours ago", maxMs: MISSING_AFTER_MS, missing: false },
  { label: "12h–7d", description: "12 hours to 7 days ago", maxMs: 7 * 24 * HOUR_MS, missing: true },
  { label: ">7d", description: "over 7 days ago", maxMs: Number.POSITIVE_INFINITY, missing: true },
  { label: "never", description: "never", maxMs: null, missing: true },
];

/** Index into CHECKIN_BUCKETS for a node. A future ohai_time (clock skew) counts as now. */
export function checkInBucket(node: FleetNode, nowMs: number): number {
  if (node.ohaiTime === null) return CHECKIN_BUCKETS.length - 1;
  const delta = Math.max(0, nowMs - node.ohaiTime * 1000);
  return CHECKIN_BUCKETS.findIndex((b) => b.maxMs !== null && delta <= b.maxMs);
}

/** Checked in within RECENT_WITHIN_MS (inclusive). Never-seen nodes are not recent. */
export function isRecent(node: FleetNode, nowMs: number): boolean {
  if (node.ohaiTime === null) return false;
  return nowMs - node.ohaiTime * 1000 <= RECENT_WITHIN_MS;
}

/**
 * Missing: hasn't reported within MISSING_AFTER_MS, OR has never reported at
 * all (no ohai_time). A brand-new node that has never converged reads as
 * missing until its first run — which is the honest signal for "we're waiting
 * on this node".
 */
export function isMissing(
  node: FleetNode,
  nowMs: number,
  thresholdMs = MISSING_AFTER_MS,
): boolean {
  if (node.ohaiTime === null) return true;
  return nowMs - node.ohaiTime * 1000 > thresholdMs;
}

/**
 * Empty run list: nothing tells the node what to do, so it converges to a
 * no-op. A policyfile node has an empty run_list but a policy_name, so it is
 * configured.
 */
export function hasEmptyRunList(node: FleetNode): boolean {
  return node.runList.length === 0 && !node.policyName;
}

/**
 * Left in `_default`: nobody assigned the node an environment, so it gets no
 * environment pins or attributes. Policyfile nodes use policy_group instead of
 * environments and normally sit in `_default`, so they're exempt. An unknown
 * environment (null) is not flagged — we don't guess.
 */
export function isDefaultEnvironment(node: FleetNode): boolean {
  return node.environment === DEFAULT_ENVIRONMENT && !node.policyName;
}

/** Unconfigured: an empty run list, or left in `_default` (see the two above). */
export function isUnconfigured(node: FleetNode): boolean {
  return hasEmptyRunList(node) || isDefaultEnvironment(node);
}

/**
 * Compare two dotted numeric versions ("18.4.12"). Returns -1/0/1. Non-numeric
 * trailing segments (pre-release tags) are ignored; missing segments count as 0,
 * so "18.4" < "18.4.1".
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .split(".")
      .map((s) => parseInt(s, 10))
      .map((n) => (Number.isNaN(n) ? 0 : n));
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** The highest client version present in the fleet, or null if none reported one. */
export function newestVersion(nodes: FleetNode[]): string | null {
  let newest: string | null = null;
  for (const n of nodes) {
    if (n.chefVersion === null) continue;
    if (newest === null || compareVersions(n.chefVersion, newest) > 0) {
      newest = n.chefVersion;
    }
  }
  return newest;
}

/** The major component of a dotted version, or null if unparseable. */
export function majorOf(version: string): number | null {
  const m = parseInt(version.split(".")[0], 10);
  return Number.isNaN(m) ? null : m;
}

/**
 * Classify a single client version against the lifecycle. EOL takes precedence
 * over major-behind (an EOL client is also behind, but EOL is the headline). The
 * "latest major" bar comes from the lifecycle source; when that's unavailable
 * (endoflife.date unreachable) we fall back to the supplied major so
 * "major behind" still works relative to what's deployed — only EOL goes dark.
 */
export function versionStatus(
  version: string | null,
  lifecycle: ClientLifecycle,
  fallbackLatestMajor: number | null,
): ClientStatus {
  if (version === null) return "unknown";
  const major = majorOf(version);
  if (major === null) return "unknown";
  if (lifecycle.eolMajors.includes(major)) return "eol";
  const latest = lifecycle.latestMajor ?? fallbackLatestMajor;
  if (latest !== null && latest - major >= 1) return "major-behind";
  return "current";
}

/** Classify a fleet node's client version (see versionStatus). */
export function clientStatus(
  node: FleetNode,
  lifecycle: ClientLifecycle,
  fallbackLatestMajor: number | null,
): ClientStatus {
  return versionStatus(node.chefVersion, lifecycle, fallbackLatestMajor);
}

/** Primary badge for a node: missing wins over unconfigured wins over ok. */
function primaryStatus(node: FleetNode, nowMs: number): NodeStatus {
  if (isMissing(node, nowMs)) return "missing";
  if (isUnconfigured(node)) return "unconfigured";
  return "ok";
}

const EMPTY_LIFECYCLE: ClientLifecycle = {
  latestMajor: null,
  latestVersion: null,
  eolMajors: [],
};

/**
 * Roll a parsed fleet into the dashboard snapshot. The stat counts are
 * INDEPENDENT diagnostics, so a node can contribute to more than one (a fresh,
 * never-converged node with an empty run list is both missing and unconfigured).
 * The per-node `status` badge, by contrast, is single-valued by priority.
 * `outdated` splits into `eol` and `majorBehind`, which are mutually exclusive
 * (eol wins) so they sum to `outdated`. Nodes are sorted most-recently-seen
 * first, so freshly-scanned nodes surface at the top of the live list.
 */
export function buildSnapshot(
  nodes: FleetNode[],
  nowMs: number,
  lifecycle: ClientLifecycle = EMPTY_LIFECYCLE,
): FleetSnapshot {
  const fleetNewest = newestVersion(nodes);
  const fallbackMajor = fleetNewest ? majorOf(fleetNewest) : null;
  const statusOf = (n: FleetNode) => clientStatus(n, lifecycle, fallbackMajor);

  const eol = nodes.filter((n) => statusOf(n) === "eol").length;
  const majorBehind = nodes.filter((n) => statusOf(n) === "major-behind").length;

  const checkIns = CHECKIN_BUCKETS.map(() => 0);
  for (const n of nodes) checkIns[checkInBucket(n, nowMs)]++;

  const stats: FleetStats = {
    total: nodes.length,
    recent: nodes.filter((n) => isRecent(n, nowMs)).length,
    missing: nodes.filter((n) => isMissing(n, nowMs)).length,
    never: nodes.filter((n) => n.ohaiTime === null).length,
    unconfigured: nodes.filter(isUnconfigured).length,
    emptyRunList: nodes.filter(hasEmptyRunList).length,
    defaultEnv: nodes.filter(isDefaultEnvironment).length,
    checkIns,
    outdated: eol + majorBehind,
    eol,
    majorBehind,
    latestMajor: lifecycle.latestMajor ?? fallbackMajor,
    latestVersion: lifecycle.latestVersion,
  };

  const summaries: NodeSummary[] = nodes
    .map((n) => ({
      name: n.name,
      status: primaryStatus(n, nowMs),
      missing: isMissing(n, nowMs),
      unconfigured: isUnconfigured(n),
      emptyRunList: hasEmptyRunList(n),
      defaultEnv: isDefaultEnvironment(n),
      recent: isRecent(n, nowMs),
      lastCheckIn: n.ohaiTime,
      chefVersion: n.chefVersion,
      clientStatus: statusOf(n),
      environment: n.environment,
      platform: n.platform,
      platformVersion: n.platformVersion,
    }))
    .sort((a, b) => (b.lastCheckIn ?? 0) - (a.lastCheckIn ?? 0));

  return { stats, nodes: summaries, generatedAt: nowMs };
}
