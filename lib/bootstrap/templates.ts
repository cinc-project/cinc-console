import type { FleetNode } from "@/lib/cinc/fleet";
import { settingsError, type BootstrapSettings } from "./validate";

/** "Set it up like <node>": an existing node's management settings to copy. */
export type BootstrapTemplate = {
  node: string;
  settings: BootstrapSettings;
  /** One line for the page, e.g. "role[base] in production". */
  summary: string;
};

function settingsOf(n: FleetNode): BootstrapSettings {
  if (n.policyName && n.policyGroup) {
    return { mode: "policy", policyGroup: n.policyGroup, policyName: n.policyName };
  }
  return { mode: "roles", environment: n.environment ?? "_default", runList: n.runList };
}

function summarize(s: BootstrapSettings): string {
  if (s.mode === "policy") return `${s.policyName} from group ${s.policyGroup}`;
  const runs = s.runList.length ? s.runList.join(", ") : "no run list";
  return `${runs} in ${s.environment}`;
}

/** One template per node whose settings are valid to bootstrap with, by name. */
export function templatesFromFleet(nodes: FleetNode[]): BootstrapTemplate[] {
  return nodes
    .map((n) => ({ node: n.name, settings: settingsOf(n) }))
    .filter((t) => settingsError(t.settings) === null)
    .map((t) => ({ ...t, summary: summarize(t.settings) }))
    .sort((a, b) => a.node.localeCompare(b.node));
}
