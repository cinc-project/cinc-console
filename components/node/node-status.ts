// Pure wording for a node's health lines (sidebar checklist + overview tiles).
// Each line carries its meaning in text; the tone only picks color + icon, so
// nothing relies on color alone.

import { relativeAgo } from "@/lib/time";
import { majorOf, type ClientStatus } from "@/lib/cinc/fleet";
import { checkIn, unconfigured, type NodeFacts } from "@/lib/cinc/node-facts";
import type { OsSupport } from "@/lib/cinc/os-lifecycle";

export type Tone = "success" | "warn" | "danger" | "muted";
export type StatusLine = { tone: Tone; text: string };

/** "2030-06-30" -> "Jun 2030" (UTC, locale-independent so SSR is stable). */
export function monthYear(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function checkInLine(facts: NodeFacts, nowMs: number): StatusLine {
  const state = checkIn(facts, nowMs);
  if (state === "never") return { tone: "warn", text: "Never checked in" };
  const ago = relativeAgo(nowMs - (facts.ohaiTime ?? 0) * 1000);
  if (state === "missing") return { tone: "danger", text: `Missing: last check-in ${ago}` };
  return { tone: "success", text: `Checked in ${ago}` };
}

export function clientLine(
  facts: NodeFacts,
  status: ClientStatus,
  latestMajor: number | null,
): StatusLine {
  const v = facts.clientVersion;
  if (!v) return { tone: "muted", text: "Client version not reported" };
  if (status === "eol") return { tone: "danger", text: `Client ${v} is end-of-life` };
  if (status === "major-behind") {
    const major = majorOf(v);
    const behind = latestMajor !== null && major !== null ? latestMajor - major : 1;
    return {
      tone: "warn",
      text: `Client ${v}, ${behind <= 1 ? "one major" : `${behind} majors`} behind`,
    };
  }
  if (status === "current") return { tone: "success", text: `Client ${v}, current` };
  return { tone: "muted", text: `Client ${v}` };
}

export function configLine(facts: NodeFacts): StatusLine {
  if (facts.policyName) {
    const group = facts.policyGroup ? ` (${facts.policyGroup})` : "";
    return { tone: "success", text: `Policy ${facts.policyName}${group}` };
  }
  const { emptyRunList, defaultEnv } = unconfigured(facts);
  if (emptyRunList && defaultEnv) return { tone: "warn", text: "No run list, in _default" };
  if (emptyRunList) return { tone: "warn", text: "No run list" };
  if (defaultEnv) return { tone: "warn", text: "In the _default environment" };
  const n = facts.runList.length;
  return { tone: "success", text: `Run list: ${n} ${n === 1 ? "entry" : "entries"}` };
}

/** null when support status is unknown — the line is omitted, not guessed. */
export function osLine(os: OsSupport): StatusLine | null {
  if (os.status === "supported")
    return {
      tone: "success",
      text: os.until ? `OS supported until ${monthYear(os.until)}` : "OS still supported",
    };
  if (os.status === "eol")
    return {
      tone: "danger",
      text: os.since ? `OS end-of-life since ${monthYear(os.since)}` : "OS is end-of-life",
    };
  return null;
}
