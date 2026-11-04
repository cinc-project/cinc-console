"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { PrimaryNavLinks } from "@/components/primary-nav";
import { UserMenu } from "@/components/user-menu";
import { IconClose, IconMenu } from "@/components/ui/icons";
import { trapTab } from "@/components/ui/focus-trap";

/**
 * Phone/tablet navigation: a Menu button (hidden from `md` up, where the
 * sidebar shows) that slides a drawer in from the left with the section links
 * and the user's profile / sign-out. Follows the project's modal pattern
 * (ConfirmDialog): focus moves into the drawer on open, Tab is trapped,
 * Escape or a backdrop tap closes it, and focus returns to the Menu button.
 * It also closes itself on navigation, since tapping a link is the usual exit.
 *
 * The drawer is portaled to <body>: the sticky header uses backdrop-filter,
 * which makes it the containing block for `position: fixed` descendants, so
 * rendered in place the "full-screen" drawer would be clipped to the header.
 */
export function MobileNav({ org, displayName }: { org: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const pathname = usePathname();

  // Close when the route changes (a link in the drawer was followed). Adjusting
  // state during render on a changed prop is React's recommended pattern here,
  // rather than an effect that would paint the stale open drawer first.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    // Stop the page behind the drawer from scrolling under a finger.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      else trapTab(e, panelRef.current);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      button?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
      >
        <span aria-hidden="true">
          <IconMenu />
        </span>
        <span className="sr-only">Menu</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 motion-safe:animate-[fade-in_150ms_ease-out]"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl motion-safe:animate-[slide-in-left_180ms_ease-out]"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 id={titleId} className="text-sm font-semibold text-text">
                  Menu
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  data-autofocus
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span aria-hidden="true">
                    <IconClose />
                  </span>
                  <span className="sr-only">Close menu</span>
                </button>
              </div>
              <nav aria-label="Primary" className="flex-1 overflow-y-auto p-3">
                <PrimaryNavLinks org={org} />
              </nav>
              <div className="border-t border-border px-4 py-3">
                <UserMenu name={displayName} />
              </div>
            </div>
          </div>,
          document.body,
      )}
    </>
  );
}
