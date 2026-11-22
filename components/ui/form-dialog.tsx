"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { trapTab } from "./focus-trap";

/**
 * Accessible modal holding a small form (a password, a new key). Like
 * ConfirmDialog and PromptDialog: Escape and a backdrop click cancel, Tab is
 * kept inside, focus moves to the first field on open and back to the opener
 * on close. The caller owns the fields and their state; mount it fresh per
 * open (`{open && <FormDialog …/>}`) so nothing stale survives a reopen.
 */
export function FormDialog({
  title,
  description,
  submitLabel,
  submitVariant = "primary",
  canSubmit = true,
  pending = false,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  description?: ReactNode;
  submitLabel: string;
  submitVariant?: "primary" | "danger";
  canSubmit?: boolean;
  pending?: boolean;
  /** A server or validation error, announced as an alert. */
  error?: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])")
      ?.focus();
    return () => restoreRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      else trapTab(e, dialogRef.current);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !pending) onSubmit();
          }}
        >
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description && (
            <div id={descId} className="text-sm text-muted">
              {description}
            </div>
          )}
          {children}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={submitVariant} disabled={!canSubmit || pending}>
              {pending ? `${submitLabel}…` : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
