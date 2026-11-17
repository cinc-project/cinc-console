"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { IconSearch } from "@/components/ui/icons";
import { EmptyState } from "@/components/details/primitives";
import {
  LEVELS,
  countLeaves,
  leaves,
  mergeAttributes,
  type Level,
  type MergedLeaf,
  type MergedNode,
} from "@/lib/cinc/merge-attributes";

type Mode = "merged" | Level;

const MAX_MATCHES = 200;
const OHAI_GROUP = "\u0000ohai";

const levelClass: Record<Level, string> = {
  default: "text-muted",
  normal: "text-link",
  override: "text-warn",
  automatic: "text-success",
};

function display(value: unknown): string {
  if (typeof value === "string") return value === "" ? '""' : value;
  const s = JSON.stringify(value);
  return s === undefined ? String(value) : s;
}

function ohaiOnly(n: MergedNode): boolean {
  return n.kind === "leaf" ? n.source === "automatic" : n.sources.every((s) => s === "automatic");
}

function LevelTag({ level }: { level: Level }) {
  return (
    <span className={cn("text-xs", levelClass[level])}>
      <span className="sr-only">set by </span>
      {level}
    </span>
  );
}

function LeafRow({
  leaf,
  depth,
  showSource,
  fullPath = false,
}: {
  leaf: MergedLeaf;
  depth: number;
  showSource: boolean;
  fullPath?: boolean;
}) {
  const text = display(leaf.value);
  return (
    <li
      className={cn(
        "grid gap-x-4 border-t border-border/60 py-1.5 pr-4 font-mono text-[13px]",
        showSource ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)_6rem]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
      )}
      style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
    >
      <span className="break-all text-muted">{fullPath ? leaf.path.join(".") : leaf.key}</span>
      <span className="min-w-0">
        <span
          className={cn("block break-all", typeof leaf.value === "string" ? "text-text" : "text-link")}
          title={text.length > 300 ? text : undefined}
        >
          {text.length > 300 ? `${text.slice(0, 300)}…` : text}
        </span>
        {showSource &&
          leaf.shadowed.map((s) => (
            <span key={s.level} className="block font-sans text-xs text-muted">
              <span className="sr-only">replaces </span>
              <s>{display(s.value)}</s> from {s.level}
            </span>
          ))}
      </span>
      {showSource && <LevelTag level={leaf.source} />}
    </li>
  );
}

function Rows({
  nodes,
  depth,
  showSource,
  expanded,
  toggle,
}: {
  nodes: MergedNode[];
  depth: number;
  showSource: boolean;
  expanded: Set<string>;
  toggle: (key: string) => void;
}) {
  return (
    <ul>
      {nodes.map((n) => {
        if (n.kind === "leaf")
          return <LeafRow key={n.key} leaf={n} depth={depth} showSource={showSource} />;
        const id = n.path.join("\u0000");
        const open = expanded.has(id);
        return (
          <li key={n.key}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(id)}
              className={cn(
                "grid w-full gap-x-4 border-t border-border/60 py-1.5 pr-4 text-left font-mono text-[13px] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                showSource ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)_6rem]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
              )}
              style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
            >
              <span className="break-all text-text">
                <span aria-hidden="true" className="inline-block w-4 text-muted">
                  {open ? "▾" : "▸"}
                </span>
                {n.key}
              </span>
              <span className="font-sans text-xs text-muted">
                {n.children.length} {n.children.length === 1 ? "key" : "keys"}
              </span>
              {showSource && (
                <span className="font-sans text-xs text-muted">{n.sources.join(", ")}</span>
              )}
            </button>
            {open && (
              <Rows
                nodes={n.children}
                depth={depth + 1}
                showSource={showSource}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Attributes tab. "Merged" shows the value the client actually sees for every
 * key and which precedence level set it (with any lower-level value it
 * replaced); the level buttons browse one stored level on its own. Keys only
 * Ohai reports are folded into one group so they don't bury the attributes
 * people set. Typing in the filter switches to a flat list of matching paths.
 */
export function AttributesView({ levels }: { levels: Record<Level, unknown> }) {
  const [mode, setMode] = useState<Mode>("merged");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const nodes = useMemo(
    () => mergeAttributes(mode === "merged" ? levels : { [mode]: levels[mode] }),
    [levels, mode],
  );
  const counts = useMemo(
    () => Object.fromEntries(LEVELS.map((l) => [l, countLeaves(levels[l])])) as Record<Level, number>,
    [levels],
  );
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return leaves(nodes).filter(
      (l) => l.path.join(".").toLowerCase().includes(q) || display(l.value).toLowerCase().includes(q),
    );
  }, [nodes, q]);

  const showSource = mode === "merged";
  const ownNodes = showSource ? nodes.filter((n) => !ohaiOnly(n)) : nodes;
  const ohaiNodes = showSource ? nodes.filter(ohaiOnly) : [];
  const ohaiOpen = expanded.has(OHAI_GROUP);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const modes: Array<{ mode: Mode; label: string; count?: number }> = [
    { mode: "merged", label: "Merged" },
    ...LEVELS.map((l) => ({ mode: l, label: l[0].toUpperCase() + l.slice(1), count: counts[l] })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Attribute level" className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
          {modes.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mode === m.mode ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text",
              )}
            >
              {m.label}
              {m.count !== undefined && <span className="ml-1.5 tabular-nums opacity-80">{m.count}</span>}
            </button>
          ))}
        </div>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 text-muted focus-within:ring-2 focus-within:ring-primary sm:max-w-sm">
          <span aria-hidden="true">
            <IconSearch />
          </span>
          <span className="sr-only">Filter attributes by path or value</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by path or value"
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </label>
      </div>

      {showSource && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <span>The value the client sees. Higher levels win:</span>
          {LEVELS.map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              <span className={cn("rounded border border-border px-1.5", levelClass[l])}>{l}</span>
            </span>
          ))}
        </p>
      )}

      <Card flush className="overflow-hidden">
        <div
          aria-hidden="true"
          className={cn(
            "grid gap-x-4 px-4 py-2 text-xs text-muted",
            showSource ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)_6rem]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
          )}
        >
          <span>Key</span>
          <span>Value</span>
          {showSource && <span>Set by</span>}
        </div>

        <p aria-live="polite" className="sr-only">
          {q ? `${matches.length} matching ${matches.length === 1 ? "attribute" : "attributes"}` : ""}
        </p>

        {q ? (
          matches.length === 0 ? (
            <div className="border-t border-border px-4 py-4">
              <EmptyState>No attributes match “{query.trim()}”.</EmptyState>
            </div>
          ) : (
            <>
              <ul>
                {matches.slice(0, MAX_MATCHES).map((l) => (
                  <LeafRow key={l.path.join("\u0000")} leaf={l} depth={0} showSource={showSource} fullPath />
                ))}
              </ul>
              {matches.length > MAX_MATCHES && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">
                  Showing the first {MAX_MATCHES} of {matches.length} matches. Narrow the filter to see the rest.
                </p>
              )}
            </>
          )
        ) : nodes.length === 0 ? (
          <div className="border-t border-border px-4 py-4">
            <EmptyState>No attributes at this level.</EmptyState>
          </div>
        ) : (
          <>
            <Rows nodes={ownNodes} depth={0} showSource={showSource} expanded={expanded} toggle={toggle} />
            {ohaiNodes.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={ohaiOpen}
                  onClick={() => toggle(OHAI_GROUP)}
                  className="flex w-full items-center gap-2 border-t border-border bg-surface-2 px-4 py-2 text-left text-sm hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span aria-hidden="true" className="w-4 text-muted">{ohaiOpen ? "▾" : "▸"}</span>
                  Reported by Ohai
                  <span className="text-xs text-muted">
                    {ohaiNodes.length} keys only the client sets (automatic)
                  </span>
                </button>
                {ohaiOpen && (
                  <Rows nodes={ohaiNodes} depth={1} showSource={showSource} expanded={expanded} toggle={toggle} />
                )}
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
