"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/cinc/users";
import { saveProfile, changePassword } from "./actions";

type Status = { kind: "ok" | "err"; text: string } | null;

function explain(e: string): string {
  return e === "forbidden"
    ? "You don't have permission to change this."
    : e;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  // The label must point at its input, or screen readers announce it unnamed.
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-muted">
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

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role="alert"
      className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-danger"}
    >
      {status.text}
    </p>
  );
}

export function ProfileForm({
  initial,
  authMode,
}: {
  initial: User;
  authMode: "local" | "ldap";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [firstName, setFirstName] = useState(initial.first_name ?? "");
  const [lastName, setLastName] = useState(initial.last_name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [detailStatus, setDetailStatus] = useState<Status>(null);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwStatus, setPwStatus] = useState<Status>(null);

  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailStatus(null);
    startTransition(async () => {
      const res = await saveProfile({
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        email,
      });
      if ("ok" in res) {
        setDetailStatus({ kind: "ok", text: "Saved." });
        router.refresh();
      } else {
        setDetailStatus({ kind: "err", text: explain(res.error) });
      }
    });
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (pw !== pw2) {
      setPwStatus({ kind: "err", text: "passwords do not match" });
      return;
    }
    startTransition(async () => {
      const res = await changePassword(pw);
      if ("ok" in res) {
        setPwStatus({ kind: "ok", text: "Password changed." });
        setPw("");
        setPw2("");
      } else {
        setPwStatus({ kind: "err", text: explain(res.error) });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submitDetails} className="space-y-4">
          <h2 className="font-medium">Details</h2>
          <Field label="Display name" value={displayName} onChange={setDisplayName} />
          <Field label="First name" value={firstName} onChange={setFirstName} />
          <Field label="Last name" value={lastName} onChange={setLastName} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <StatusLine status={detailStatus} />
          <Button type="submit" disabled={pending}>
            Save details
          </Button>
        </form>
      </Card>

      {authMode === "ldap" ? (
        <Card>
          <h2 className="font-medium">Change password</h2>
          <p className="mt-2 text-sm text-muted">
            Your password is managed by your organization&rsquo;s directory.
            Contact your administrator to change it.
          </p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submitPassword} className="space-y-4">
            <h2 className="font-medium">Change password</h2>
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
            <StatusLine status={pwStatus} />
            <Button type="submit" disabled={pending || !pw}>
              Change password
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
