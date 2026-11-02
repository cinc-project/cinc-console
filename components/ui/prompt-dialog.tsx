"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { trapTab } from "./focus-trap";
import { nameError, type NameKind } from "@/lib/cinc/names";

/**
 * Accessible single-field prompt modal. Like ConfirmDialog, but asks for one
 * value before confirming — e.g. the name for a duplicated object. The input is
 * focused on open, validated against Chef's name rules when `nameKind` is set,
 * and the confirm button stays disabled until the value is non-empty and valid.
 * Escape and a backdrop click cancel; Tab is kept inside the dialog and focus
 * is restored to the opener on close.
 */
export function PromptDialog({
  open,
  title,
  label,
  confirmLabel = "Confirm",
  nameKind,
  pending = false,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel?: string;
  /** When set, the value is validated against Chef's rules for this object. */
  nameKind?: NameKind;
  /** Disables the form while the submit action is in flight. */
  pending?: boolean;
  /** A server-side error (e.g. name already taken) shown as an alert. */
  error?: string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const inputId = useId();
  const errorId = useId();

  // Focus the input on open and restore focus to whatever opened it on close.
  // The field starts empty from initial state — callers mount this fresh per
  // open (e.g. `{open && <PromptDialog .../>}`) so there's no stale value.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
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

  const validationError = nameKind ? nameError(nameKind, value) : null;
  const canSubmit = !pending && value.trim() !== "" && !validationError;
  const shownError = validationError ?? error ?? null;

  function submit() {
    if (!canSubmit) return;
    onSubmit(value.trim());
  }

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
        className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        <div className="mb-4 space-y-1">
          <label htmlFor={inputId} className="block text-sm text-muted">
            {label}
          </label>
          <Input
            id={inputId}
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={pending}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? errorId : undefined}
          />
          {shownError && (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {shownError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {pending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
