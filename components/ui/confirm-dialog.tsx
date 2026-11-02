"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { trapTab } from "./focus-trap";

/**
 * Accessible confirmation modal. Replaces native confirm() so destructive and
 * high-consequence actions get a styled, contextual prompt. Escape and a
 * backdrop click cancel; the confirm button is focused on open, Tab is kept
 * inside the dialog, and focus is restored to the opener on close.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const descId = useId();

  // Remember the opener before moving focus in, and restore it on close. This
  // can't use autoFocus: React applies it at commit, before this effect runs,
  // so activeElement would already be the confirm button.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus();
    return () => restoreRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      else trapTab(e, dialogRef.current);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={children ? descId : undefined}
        className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        {children && (
          <div id={descId} className="mb-4 text-sm text-muted">
            {children}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
