import { nameError } from "@/lib/cinc/names";

/**
 * How a bootstrapped node is managed. The two modes exclude each other:
 * cinc-client aborts a run that sets an environment alongside a policy.
 */
export type BootstrapSettings =
  | { mode: "roles"; environment: string; runList: string[] }
  | { mode: "policy"; policyGroup: string; policyName: string };

/**
 * The bootstrap name is both the node's and its API client's, so it must pass
 * both rules. The client's is the stricter one: a node may contain `:`.
 */
export function bootstrapNameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Enter a name.";
  const asNode = nameError("node", name);
  if (asNode) return asNode;
  if (nameError("client", name)) {
    return "Use only letters, numbers, and . _ - (the name is also the client's).";
  }
  return null;
}

// role[NAME] | recipe[COOKBOOK] | recipe[COOKBOOK::RECIPE], recipes optionally
// pinned to a version (recipe[apt@1.2.3]), as real run lists carry them.
const RUN_LIST_ENTRY =
  /^(role\[[\-A-Za-z0-9_]+\]|recipe\[[\-A-Za-z0-9_.]+(::[\-A-Za-z0-9_.]+)?(@\d+(\.\d+){0,2})?\])$/;

export function runListEntryError(entry: string): string | null {
  return RUN_LIST_ENTRY.test(entry)
    ? null
    : `"${entry}" isn't a run-list entry. Use role[NAME] or recipe[COOKBOOK].`;
}

const untrimmed = (v: string) => v !== v.trim();

/**
 * The first problem with `s`, or null. `_default` is a valid environment here.
 * Values must already be trimmed: they land verbatim in a shell command and
 * in first-boot.json, and nameError alone tolerates surrounding whitespace.
 */
export function settingsError(s: BootstrapSettings): string | null {
  const values = s.mode === "roles" ? [s.environment] : [s.policyGroup, s.policyName];
  if (values.some(untrimmed)) return "Remove the spaces around the name.";
  if (s.mode === "roles") {
    if (!s.environment) return "Choose an environment.";
    if (s.environment !== "_default") {
      const env = nameError("environment", s.environment);
      if (env) return `Environment: ${env}`;
    }
    for (const entry of s.runList) {
      const err = runListEntryError(entry);
      if (err) return err;
    }
    return null;
  }
  if (!s.policyGroup) return "Choose a policy group.";
  if (!s.policyName) return "Choose a policy.";
  const group = nameError("policy_group", s.policyGroup);
  if (group) return `Policy group: ${group}`;
  const policy = nameError("policy_name", s.policyName);
  if (policy) return `Policy: ${policy}`;
  return null;
}
