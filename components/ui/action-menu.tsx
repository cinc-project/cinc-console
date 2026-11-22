"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./button";

export type MenuItem = {
  label: string;
  /** A short second line, e.g. what the action affects. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

function IconMore() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

/**
 * A "⋯" button that discloses a short list of actions. It is a disclosure
 * (button + `aria-expanded` + a group of buttons), not an ARIA `role="menu"`:
 * Tab moves through the items, Escape or a click outside closes it, and focus
 * goes back to the trigger.
 *
 * Choosing an item focuses the trigger first, then runs `onSelect`, so a
 * dialog the item opens remembers the trigger as its opener and restores focus
 * there (the item itself is gone once the list closes).
 */
export function ActionMenu({
  label,
  items,
  variant = "ghost",
  className,
}: {
  /** Accessible name of the trigger, e.g. "Actions for key default". */
  label: string;
  items: Array<MenuItem | "separator">;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>("[data-menu-item]:not([disabled])")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function choose(item: MenuItem) {
    setOpen(false);
    triggerRef.current?.focus();
    item.onSelect();
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-block", className)}
      onBlur={(e) => {
        // Tabbing out of the list closes it.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={buttonClass(variant, "px-2")}
        onClick={() => setOpen((o) => !o)}
      >
        <IconMore />
      </button>
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-1 grid min-w-56 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-md)]"
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <hr key={`sep-${i}`} className="my-1 border-border" />
            ) : (
              <button
                key={item.label}
                type="button"
                data-menu-item
                disabled={item.disabled}
                onClick={() => choose(item)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left text-sm",
                  "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger ? "text-danger" : "text-text",
                )}
              >
                {item.label}
                {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

