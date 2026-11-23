"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Keep this far from the viewport edge. */
const EDGE = 8;

/**
 * A text tooltip under its trigger (WCAG 2.2 SC 1.4.13): shown on hover and on
 * keyboard focus, hoverable (the pointer can move onto it without it closing),
 * and dismissed with Escape without moving focus. The trigger gets its id for
 * `aria-describedby`; the tooltip stays in the DOM while hidden so screen
 * readers always read the description.
 */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  /** Render the trigger, given the id to put in its `aria-describedby`. */
  children: (describedBy: string) => ReactNode;
}) {
  const id = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hover || focus) && !dismissed;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDismissed(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Centered under the trigger, nudged back inside the viewport near an edge.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!open || !el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const dx = r.left < EDGE ? EDGE - r.left : r.right > vw - EDGE ? vw - EDGE - r.right : 0;
    el.style.marginLeft = `${dx}px`;
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        setHover(true);
        setDismissed(false);
      }}
      onMouseLeave={() => setHover(false)}
      onFocus={() => {
        setFocus(true);
        setDismissed(false);
      }}
      onBlur={() => setFocus(false)}
    >
      {children(id)}
      {/* The top padding bridges the gap so moving onto the tooltip keeps it open. */}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        hidden={!open}
        className="absolute left-1/2 top-full z-30 -translate-x-1/2 pt-1"
      >
        <span className="block w-max max-w-xs rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-normal text-text shadow-md">
          {content}
        </span>
      </span>
    </span>
  );
}
