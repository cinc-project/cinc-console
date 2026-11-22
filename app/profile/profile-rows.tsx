"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { DetailRow, Unset } from "@/components/ui/detail-rows";
import { IconCheck } from "@/components/ui/icons";
import type { User } from "@/lib/cinc/users";
import type { ActionResult } from "@/lib/cinc/action";
import type { ProfileDetails } from "@/lib/user-fields";
import { saveProfile, changePassword } from "./actions";

function explain(e: string): string {
  if (e === "forbidden") return "You don't have permission to change this.";
  if (e === "password too short") return "Use at least 6 characters.";
  return e;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  className?: string;
}) {
  // The label must point at its input, or screen readers announce it unnamed.
  const id = useId();
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Saved({ text }: { text: string }) {
  return (
    <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-success">
      <span aria-hidden="true">
        <IconCheck />
      </span>
      {text}
    </p>
  );
}

/** Display name, name and email as a list, read-only. */
export function ProfileList({ data }: { data: User }) {
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
  const rows: Array<[string, string | undefined]> = [
    ["Display name", data.display_name],
    ["Name", name],
    ["Email", data.email],
  ];
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="break-words">{value ? value : <Unset />}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The Profile row. Shows the details as text; Edit swaps the same row into a
 * form, and Save or Cancel swaps it back with focus on Edit again. On /profile
 * it changes the signed-in user; another user's page passes a bound action.
 */
export function ProfileRow({
  initial,
  onSave = saveProfile,
}: {
  initial: User;
  onSave?: (details: ProfileDetails) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);

  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [firstName, setFirstName] = useState(initial.first_name ?? "");
  const [lastName, setLastName] = useState(initial.last_name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");

  function startEdit() {
    setDisplayName(initial.display_name ?? "");
    setFirstName(initial.first_name ?? "");
    setLastName(initial.last_name ?? "");
    setEmail(initial.email ?? "");
    setError(null);
    setSaved(false);
    setEditing(true);
    requestAnimationFrame(() => firstRef.current?.querySelector("input")?.focus());
  }

  function stopEdit() {
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await onSave({
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        email,
      });
      if ("ok" in res) {
        setSaved(true);
        stopEdit();
        router.refresh();
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <DetailRow
      label="Profile"
      action={
        !editing && (
          <Button ref={editRef} variant="secondary" onClick={startEdit}>
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <form onSubmit={submit} aria-label="Edit profile" className="grid gap-3 sm:grid-cols-2">
          <div ref={firstRef} className="sm:col-span-2">
            <Field label="Display name" value={displayName} onChange={setDisplayName} />
          </div>
          <Field label="First name" value={firstName} onChange={setFirstName} />
          <Field label="Last name" value={lastName} onChange={setLastName} />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            className="sm:col-span-2"
          />
          {error && (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={stopEdit} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <ProfileList data={initial} />
          {saved && <Saved text="Saved." />}
        </>
      )}
    </DetailRow>
  );
}

/**
 * The Password row. Local auth opens a dialog to set it; under LDAP the
 * directory owns passwords, so the row only says so. `self` changes the
 * wording between /profile and another user's page.
 */
export function PasswordRow({
  authMode,
  self = true,
  onChange = changePassword,
}: {
  authMode: "local" | "ldap";
  self?: boolean;
  onChange?: (password: string) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const verb = self ? "Change password" : "Set password";

  if (authMode === "ldap") {
    return (
      <DetailRow label="Password">
        <p className="text-muted">
          {self
            ? "Managed by your organization’s directory. Contact your administrator to change it."
            : "Managed by your organization’s directory."}
        </p>
      </DetailRow>
    );
  }

  function openDialog() {
    setPw("");
    setPw2("");
    setError(null);
    setDone(false);
    setOpen(true);
  }

  function submit() {
    if (pw !== pw2) {
      setError("The passwords don’t match.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await onChange(pw);
      if ("ok" in res) {
        setOpen(false);
        setDone(true);
      } else {
        setError(explain(res.error));
      }
    });
  }

  return (
    <DetailRow
      label="Password"
      action={
        <Button variant="secondary" onClick={openDialog}>
          {verb}…
        </Button>
      }
    >
      <p className="text-muted">Used to sign in to this console.</p>
      {done && <Saved text={self ? "Password changed." : "Password set."} />}
      {open && (
        <FormDialog
          title={verb}
          description="Use at least 6 characters."
          submitLabel={verb}
          canSubmit={pw !== ""}
          pending={pending}
          error={error}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        >
          <Field
            label="New password"
            value={pw}
            onChange={setPw}
            type="password"
            autoComplete="new-password"
          />
          <Field
            label="Confirm password"
            value={pw2}
            onChange={setPw2}
            type="password"
            autoComplete="new-password"
          />
        </FormDialog>
      )}
    </DetailRow>
  );
}
