// Pure merge of a node's four stored attribute levels into the view the client
// actually sees, keeping provenance: which level set each value, and which
// lower-level values it shadows. Mirrors Chef's deep merge — hashes merge key
// by key across levels; any non-hash (scalar or array) at a higher level
// replaces whatever is below it. (Arrays only concatenate *within* one level,
// e.g. two roles' defaults, and the server already stores each level combined.)

export const LEVELS = ["default", "normal", "override", "automatic"] as const;
export type Level = (typeof LEVELS)[number];

export type MergedLeaf = {
  kind: "leaf";
  key: string;
  path: string[];
  value: unknown;
  source: Level;
  /** Lower-level values this one replaced, highest first. */
  shadowed: Array<{ level: Level; value: unknown }>;
};

export type MergedBranch = {
  kind: "branch";
  key: string;
  path: string[];
  children: MergedNode[];
  /** Levels that contribute keys to this branch, in precedence order. */
  sources: Level[];
};

export type MergedNode = MergedLeaf | MergedBranch;

type Contribution = { level: Level; value: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function build(key: string, path: string[], contribs: Contribution[]): MergedNode {
  // contribs are low -> high precedence. The highest non-hash wins outright and
  // cuts off everything below it; hashes above it merge.
  let cut = -1;
  contribs.forEach((c, i) => {
    if (!isRecord(c.value)) cut = i;
  });

  if (cut === contribs.length - 1) {
    const top = contribs[cut];
    return {
      kind: "leaf",
      key,
      path,
      value: top.value,
      source: top.level,
      shadowed: contribs
        .slice(0, cut)
        .filter((c) => !isRecord(c.value))
        .reverse(),
    };
  }

  const hashes = contribs.slice(cut + 1);
  return {
    kind: "branch",
    key,
    path,
    sources: [...new Set(hashes.map((c) => c.level))],
    children: mergeChildren(path, hashes),
  };
}

function mergeChildren(path: string[], hashes: Contribution[]): MergedNode[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const h of hashes) {
    for (const k of Object.keys(h.value as Record<string, unknown>)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((k) =>
    build(
      k,
      [...path, k],
      hashes
        .filter((h) => Object.hasOwn(h.value as Record<string, unknown>, k))
        .map((h) => ({ level: h.level, value: (h.value as Record<string, unknown>)[k] })),
    ),
  );
}

/**
 * Merge the given levels (any subset; missing or non-hash levels are skipped)
 * into top-level nodes. Pass one level to browse it alone with the same shape.
 */
export function mergeAttributes(levels: Partial<Record<Level, unknown>>): MergedNode[] {
  const hashes = LEVELS.filter((l) => isRecord(levels[l])).map((l) => ({
    level: l,
    value: levels[l],
  }));
  return mergeChildren([], hashes);
}

/** Every leaf under `nodes`, depth-first, for filtering and counting. */
export function leaves(nodes: MergedNode[]): MergedLeaf[] {
  const out: MergedLeaf[] = [];
  const walk = (ns: MergedNode[]) => {
    for (const n of ns) {
      if (n.kind === "leaf") out.push(n);
      else walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Number of leaves stored at a level (counts what that level sets, merged or not). */
export function countLeaves(value: unknown): number {
  if (!isRecord(value)) return 0;
  let n = 0;
  for (const v of Object.values(value)) n += isRecord(v) ? countLeaves(v) : 1;
  return n;
}
