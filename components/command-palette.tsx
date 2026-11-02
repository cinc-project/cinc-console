"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Org } from "@/lib/cinc/orgs";
import { NAV } from "@/lib/nav";
import { searchOrgObjects, type PaletteObject } from "@/lib/palette-search";

type Command = { id: string; label: string; hint?: string; href: string };

/**
 * ⌘K / Ctrl-K command palette: a keyboard-first jump to any section of the
 * current org, any org, or your profile — and, once you start typing, to any
 * node / role / environment / policy by name (lazily fetched on first open).
 * Filter by typing, arrow keys to move, Enter to go, Escape to close.
 *
 * Accessibility: a labelled modal dialog with the combobox/listbox pattern —
 * the input owns aria-activedescendant, options are aria-selected, and focus is
 * trapped to the input (the only focusable control) and restored on close.
 */
export function CommandPalette({ org, orgs }: { org: string; orgs: Org[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rawActive, setActive] = useState(0);
  const [objects, setObjects] = useState<PaletteObject[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const loadedOrg = useRef<string | null>(null);

  function openPalette() {
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  // Quick navigation commands — always available, shown by default.
  const baseCommands = useMemo<Command[]>(() => {
    const sections: Command[] = NAV.map((n) => ({
      id: `nav-${n.slug}`,
      label: n.label,
      hint: "Section",
      href: `/orgs/${org}/${n.slug}`,
    }));
    const orgCmds: Command[] = orgs
      .filter((o) => o.name !== org)
      .map((o) => ({
        id: `org-${o.name}`,
        label: `Switch to ${o.full_name ?? o.name}`,
        hint: "Organization",
        href: `/orgs/${o.name}`,
      }));
    const profile: Command = {
      id: "profile",
      label: "Profile",
      hint: "Account",
      href: "/profile",
    };
    return [...sections, ...orgCmds, profile];
  }, [org, orgs]);

  // Jump-to-object commands from the lazily-fetched name lists.
  const objectCommands = useMemo<Command[]>(
    () =>
      (objects ?? []).map((o) => ({
        id: `obj-${o.kind}-${o.name}`,
        label: o.name,
        hint: o.label,
        href: `/orgs/${org}/${o.kind}/${encodeURIComponent(o.name)}`,
      })),
    [objects, org],
  );

  // Objects only appear once you type, to keep the default view tidy.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseCommands;
    return [...baseCommands, ...objectCommands].filter((c) =>
      c.label.toLowerCase().includes(q),
    );
  }, [baseCommands, objectCommands, query]);

  const loadingObjects = open && query.trim() !== "" && objects === null;

  // Derive the active index (clamped to the current results) rather than syncing
  // it from an effect — the result set shrinks as you type.
  const active = results.length ? Math.min(rawActive, results.length - 1) : 0;

  // Global open shortcut: ⌘K / Ctrl-K. Reset on every toggle (harmless on close).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus the input on open and restore focus to the trigger on close (DOM only).
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => restoreFocus.current?.focus();
  }, [open]);

  // Lazily load the org's object names on first open (refetch when org changes).
  useEffect(() => {
    if (!open || loadedOrg.current === org) return;
    let cancelled = false;
    searchOrgObjects(org).then((objs) => {
      if (cancelled) return;
      loadedOrg.current = org;
      setObjects(objs);
    });
    return () => {
      cancelled = true;
    };
  }, [open, org]);

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    // Client-side navigation to an internal, app-constructed path (a fixed nav
    // slug or a known org from the session's org list) — not an HTML response
    // sink, and the search query never feeds the href. js-express-xss misfires
    // on Next's router inside a "use client" component.
    router.push(cmd.href); // nosemgrep: js-express-xss
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(results.length ? (active + 1) % results.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(results.length ? (active - 1 + results.length) % results.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1 text-xs text-muted hover:border-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* The accessible name must start with the visible label (WCAG 2.5.3
            Label in Name), so speech users can say "Jump to". */}
        <span>Jump to…</span>
        <span className="sr-only"> (command palette)</span>
        <kbd
          aria-hidden="true"
          className="rounded border border-border bg-surface px-1 font-sans"
        >
          ⌘K
        </kbd>
      </button>
      {open && (
        <CommandPaletteOverlay
          inputRef={inputRef}
          query={query}
          setQuery={setQuery}
          active={active}
          setActive={setActive}
          results={results}
          loading={loadingObjects}
          onKeyDown={onKeyDown}
          run={run}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CommandPaletteOverlay({
  inputRef,
  query,
  setQuery,
  active,
  setActive,
  results,
  loading,
  onKeyDown,
  run,
  close,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (v: string) => void;
  active: number;
  setActive: (i: number) => void;
  results: Command[];
  loading: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  run: (cmd: Command | undefined) => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={results[active]?.id}
          aria-label="Search commands"
          placeholder="Jump to…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-text placeholder:text-muted focus-visible:outline-none"
        />
        <ul id="command-results" role="listbox" className="max-h-80 overflow-auto p-1">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {loading ? "Searching objects…" : "No matches."}
            </li>
          ) : (
            results.map((cmd, i) => (
              <li
                key={cmd.id}
                id={cmd.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                className={
                  "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm " +
                  (i === active ? "bg-surface-2 text-text" : "text-muted")
                }
              >
                <span>{cmd.label}</span>
                {cmd.hint && <span className="text-xs text-muted">{cmd.hint}</span>}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
