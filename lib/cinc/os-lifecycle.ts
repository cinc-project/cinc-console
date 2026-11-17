import "server-only";

// Operating-system support status from endoflife.date, the same source the
// client lifecycle uses. The Infra Server only knows what Ohai reported
// (platform + platform_version); whether that release still gets security
// fixes is external truth. Any failure degrades to "unknown" and the UI simply
// omits the line — an air-gapped console loses nothing else.

/**
 * Ohai `platform` -> endoflife.date product slug. The slug goes into the
 * request URL, so it only ever comes from this fixed table, never from node
 * data.
 */
const PRODUCTS: Record<string, string> = {
  debian: "debian",
  ubuntu: "ubuntu",
  redhat: "rhel",
  centos: "centos",
  rocky: "rocky-linux",
  almalinux: "almalinux",
  amazon: "amazon-linux",
  fedora: "fedora",
  oracle: "oracle-linux",
  suse: "sles",
  opensuseleap: "opensuse",
  alpine: "alpine-linux",
  mac_os_x: "macos",
  freebsd: "freebsd",
};

const TIMEOUT_MS = 4000;

type Cycle = { cycle: string; eol: string | boolean };

export type OsSupport =
  | { status: "supported"; until: string | null }
  | { status: "eol"; since: string | null }
  | { status: "unknown" };

const UNKNOWN: OsSupport = { status: "unknown" };

export function osProduct(platform: string | null): string | null {
  return platform ? (PRODUCTS[platform] ?? null) : null;
}

/**
 * Pure: find the release cycle a version belongs to — the longest cycle that
 * equals the version or prefixes it on a dot boundary ("13" matches "13.1",
 * "24.04" matches "24.04", "3.24" matches "3.24.4") — and read its EOL.
 */
export function parseOsSupport(cycles: Cycle[], version: string, nowMs: number): OsSupport {
  let best: Cycle | null = null;
  for (const c of cycles) {
    if (typeof c?.cycle !== "string") continue;
    const match = version === c.cycle || version.startsWith(`${c.cycle}.`);
    if (match && (!best || c.cycle.length > best.cycle.length)) best = c;
  }
  if (!best) return UNKNOWN;
  if (best.eol === false) return { status: "supported", until: null };
  if (best.eol === true) return { status: "eol", since: null };
  const at = Date.parse(best.eol);
  if (Number.isNaN(at)) return UNKNOWN;
  return at <= nowMs
    ? { status: "eol", since: best.eol }
    : { status: "supported", until: best.eol };
}

/** Fetch support status for a node's OS, cached for a day. Never throws. */
export async function getOsSupport(
  platform: string | null,
  version: string | null,
  nowMs: number,
): Promise<OsSupport> {
  const product = osProduct(platform);
  if (!product || !version) return UNKNOWN;
  try {
    const res = await fetch(`https://endoflife.date/api/${product}.json`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return UNKNOWN;
    const cycles = (await res.json()) as Cycle[];
    if (!Array.isArray(cycles)) return UNKNOWN;
    return parseOsSupport(cycles, version, nowMs);
  } catch {
    return UNKNOWN;
  }
}
