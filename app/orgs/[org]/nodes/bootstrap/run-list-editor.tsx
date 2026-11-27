"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { IconWarning } from "@/components/ui/icons";
import { runListEntryError } from "@/lib/bootstrap/validate";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 6;

type Suggestion = { entry: string; hint: string };

function kindOf(entry: string): "role" | "recipe" {
  return entry.startsWith("role[") ? "role" : "recipe";
}

function nameOf(entry: string): string {
  return entry.slice(entry.indexOf("[") + 1, -1);
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * An ordered run list (roles and recipes run top to bottom) with reorder and
 * remove controls, and a search box that suggests the org's roles and
 * cookbooks or takes any valid entry typed in full (`recipe[apt::x@1.2]`).
 * `roles`/`cookbooks` are null when they couldn't be read: typing still works.
 */
export function RunListEditor({
  entries,
  onChange,
  roles,
  cookbooks,
  disabled = false,
}: {
  entries: string[];
  onChange: (entries: string[]) => void;
  roles: string[] | null;
  cookbooks: string[] | null;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const needle = q.toLowerCase();
  const known: Suggestion[] = [
    ...(roles ?? []).map((r) => ({ entry: `role[${r}]`, hint: "role" })),
    ...(cookbooks ?? []).map((c) => ({ entry: `recipe[${c}]`, hint: "cookbook" })),
  ];
  const suggestions: Suggestion[] = needle
    ? known.filter((s) => !entries.includes(s.entry) && nameOf(s.entry).toLowerCase().includes(needle))
    : [];
  // A full entry typed by hand (a namespaced or pinned recipe, or anything
  // the lists couldn't show) is offered as-is when it's valid.
  if (q && !runListEntryError(q) && !entries.includes(q) && !suggestions.some((s) => s.entry === q)) {
    suggestions.unshift({ entry: q, hint: "as typed" });
  }
  const shown = suggestions.slice(0, MAX_SUGGESTIONS);

  function add(entry: string) {
    onChange([...entries, entry]);
    setQuery("");
    setError(null);
  }

  function move(i: number, by: -1 | 1) {
    const next = entries.slice();
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!q) return;
    if (shown.length > 0) add(shown[0].entry);
    else if (entries.includes(q)) setError(`${q} is already in the run list.`);
    else setError("Use role[NAME] or recipe[COOKBOOK], optionally recipe[COOKBOOK::RECIPE@VERSION].");
  }

  return (
    <div className="space-y-3">
      <p id={`${id}-label`} className="text-sm text-muted">
        Run list <span className="text-xs">· runs top to bottom</span>
      </p>
      {entries.length > 0 ? (
        <ol
          aria-labelledby={`${id}-label`}
          className="divide-y divide-border overflow-hidden rounded-md border border-border"
        >
          {entries.map((entry, i) => (
            <li key={entry} className="flex items-center gap-2 bg-bg py-1 pl-3 pr-1">
              <span className="w-5 text-xs text-muted">{i + 1}</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  kindOf(entry) === "role" ? "border-link/50 text-link" : "border-success/50 text-success",
                )}
              >
                {kindOf(entry)}
              </span>
              <span className="truncate font-mono text-sm">{nameOf(entry)}</span>
              <span className="ml-auto flex">
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Move ${entry} up`}
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowIcon up />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Move ${entry} down`}
                  disabled={disabled || i === entries.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowIcon up={false} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Remove ${entry}`}
                  disabled={disabled}
                  onClick={() => onChange(entries.filter((x) => x !== entry))}
                >
                  <RemoveIcon />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
          Empty. The node checks in but runs nothing.
        </p>
      )}

      {!disabled && (
        <div className="space-y-2">
          <label htmlFor={`${id}-add`} className="sr-only">
            Add a role or recipe
          </label>
          <Input
            id={`${id}-add`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a role or recipe…"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
          />
          {shown.length > 0 && (
            <div
              role="group"
              aria-label="Suggestions"
              className="flex flex-col gap-0.5 rounded-md border border-border bg-surface p-1"
            >
              {shown.map((s) => (
                <button
                  key={s.entry}
                  type="button"
                  onClick={() => add(s.entry)}
                  className="flex min-h-9 items-center gap-2 rounded px-2 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="font-mono text-sm">{s.entry}</span>
                  <span className="ml-auto text-xs text-muted">{s.hint}</span>
                </button>
              ))}
            </div>
          )}
          {q && shown.length === 0 && !error && (
            <p className="text-xs text-muted">
              No role or cookbook matches. Type a full entry, like{" "}
              <code className="font-mono">recipe[COOKBOOK::RECIPE]</code>, and press Enter.
            </p>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="flex items-center gap-2 text-sm text-danger">
              <span aria-hidden="true">
                <IconWarning />
              </span>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
