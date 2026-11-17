import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { StatusLine, Tone } from "./node-status";

const toneBadge: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  muted: "bg-surface-2 text-muted",
};

/** Round tone-colored glyph. Decorative: the adjacent text carries the status. */
export function StatusIcon({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", toneBadge[tone])}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {tone === "success" && <path d="m3.5 8.5 3 3 6-7" />}
        {tone === "warn" && <path d="M8 3.5v5.5M8 12.5v.01" />}
        {tone === "danger" && <path d="m4.5 4.5 7 7m0-7-7 7" />}
        {tone === "muted" && <path d="M4.5 8h7" />}
      </svg>
    </span>
  );
}

export function StatusItem({ line }: { line: StatusLine }) {
  return (
    <li className="flex items-center gap-2.5">
      <StatusIcon tone={line.tone} />
      <span>{line.text}</span>
    </li>
  );
}

/** A card with a plain heading, for the tab panels. */
export function NodeSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Small labeled figure used in tile grids. */
export function Stat({
  label,
  value,
  sub,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface-2 px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("text-lg font-semibold", mono && "font-mono")}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

const NEARLY_FULL = 85;
const FULL = 95;

/**
 * Horizontal usage meter. Exposed as an ARIA meter with a text value; past
 * 85% / 95% it turns amber / red AND says "nearly full" / "full", so the
 * warning never depends on color.
 */
export function UsageBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  const state = p >= FULL ? "full" : p >= NEARLY_FULL ? "nearly full" : null;
  const fill = p >= FULL ? "bg-danger" : p >= NEARLY_FULL ? "bg-warn" : "bg-link";
  return (
    <span className="flex items-center gap-2">
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-valuetext={`${p}% used${state ? `, ${state}` : ""}`}
        className="flex h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-border"
      >
        <span className={cn("rounded-full", fill)} style={{ width: `${p}%` }} />
      </span>
      <span className="w-10 text-right text-xs tabular-nums">{p}%</span>
      {state && <span className={cn("text-xs", p >= FULL ? "text-danger" : "text-warn")}>{state}</span>}
    </span>
  );
}

/** Placeholder for a fact Ohai didn't report. */
export function NotReported() {
  return <span className="text-muted">Not reported</span>;
}
