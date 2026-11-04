"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { CLI_TOOLS, useCliTool, type CliTool } from "@/components/cli-tool";

/** UPPER_CASE words in a command are placeholders the user fills in. */
const PLACEHOLDER = /\b([A-Z][A-Z_]{2,})\b/g;

function renderLine(line: string): ReactNode[] {
  return line.split(PLACEHOLDER).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-semibold text-text">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * A workstation command shown for both Cinc CLI (default) and knife, with a
 * tab switch shared across the page and remembered in the browser (see
 * useCliTool). Follows the WAI-ARIA tabs pattern: arrow keys move between the
 * tabs, and only the selected tab is in the Tab order. Copy puts just the
 * commands on the clipboard — no "$" prompts.
 */
export function CommandSnippet({
  commands,
  notes,
  className,
}: {
  /** One or more command lines per tool. */
  commands: Record<CliTool, string[]>;
  /** Optional per-tool line shown under the commands. */
  notes?: Partial<Record<CliTool, ReactNode>>;
  className?: string;
}) {
  const [tool, setTool] = useCliTool();
  const id = useId();
  const tabRefs = useRef<Record<CliTool, HTMLButtonElement | null>>({
    cinc: null,
    knife: null,
  });
  const lines = commands[tool];
  const note = notes?.[tool];

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const i = CLI_TOOLS.findIndex((t) => t.id === tool);
    const n = CLI_TOOLS.length;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? n - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    const nextTool = CLI_TOOLS[next].id;
    setTool(nextTool);
    tabRefs.current[nextTool]?.focus();
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-bg text-left",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border px-2">
        <div role="tablist" aria-label="Command-line tool" className="flex">
          {CLI_TOOLS.map((t) => {
            const selected = t.id === tool;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTool(t.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "-mb-px border-b-2 px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  selected
                    ? "border-primary font-medium text-text"
                    : "border-transparent text-muted hover:text-text",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <CopyButton
          value={lines.join("\n")}
          label="Copy command"
          className="ml-auto px-1.5 py-1"
        />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tool}`}
        className="px-3 py-2.5"
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted">
          {lines.map((line, i) => (
            <span key={i} className="block">
              <span aria-hidden="true" className="select-none">
                ${" "}
              </span>
              <span className="text-text/90">{renderLine(line)}</span>
            </span>
          ))}
        </pre>
        {note && <p className="mt-2 text-xs text-muted">{note}</p>}
      </div>
    </div>
  );
}
