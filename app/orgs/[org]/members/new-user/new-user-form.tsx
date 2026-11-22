"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OneTimeKey } from "@/components/one-time-key";
import { MIN_PASSWORD, USERNAME } from "@/lib/user-fields";
import type { CreateUserResult, Membership, NewUserInput } from "../users/actions";

function explain(error: string): string {
  switch (error) {
    case "forbidden":
      return "Only the superuser or a server administrator can create users.";
    case "already exists":
      return "A user with that username already exists.";
    case "invalid username":
      return "Use only lowercase letters, numbers, _ and - in the username.";
    case "display name required":
      return "Enter a display name.";
    case "invalid email":
      return "Enter a valid email address.";
    case "password too short":
      return `Use at least ${MIN_PASSWORD} characters for the password.`;
    default:
      return error;
  }
}

function membershipText(m: Membership, name: string, org: string): string {
  switch (m) {
    case "added":
      return `${name} is a member of ${org}.`;
    case "invited":
      return `${name} was invited to ${org} and joins once they accept. Only the superuser can add members directly.`;
    case "failed":
      return `${name} was created, but couldn't be added to or invited to ${org}.`;
    default:
      return `${name} isn't in any organization yet.`;
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="max-w-md"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Create a user (superuser or server admin only), give them a key, and
 * optionally bring them into this org.
 */
export function NewUserForm({
  org,
  authMode,
  onCreate,
}: {
  org: string;
  authMode: "local" | "ldap";
  onCreate: (input: NewUserInput) => Promise<CreateUserResult>;
}) {
  const id = useId();
  const base = `/orgs/${org}/members`;
  const [f, setF] = useState({
    username: "",
    display_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [keyMode, setKeyMode] = useState<"generate" | "paste">("generate");
  const [publicKey, setPublicKey] = useState("");
  const [addToOrg, setAddToOrg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    name: string;
    privateKey?: string;
    membership: Membership;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const badUsername = f.username !== "" && !USERNAME.test(f.username);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await onCreate({
        ...f,
        password: authMode === "ldap" ? undefined : f.password,
        publicKey: keyMode === "paste" ? publicKey : undefined,
        addToOrg,
      });
      if ("ok" in res) {
        setCreated({ name: f.username, privateKey: res.privateKey, membership: res.membership });
      } else {
        setError(explain(res.error));
      }
    });
  }

  if (created) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">
          User <span className="font-mono">{created.name}</span> created
        </h1>
        <p role="status" className="text-sm text-text">
          {membershipText(created.membership, created.name, org)}
        </p>
        {created.privateKey ? (
          <OneTimeKey
            filename={created.name}
            privateKey={created.privateKey}
            label={`Private key for ${created.name}`}
            hint="Give it to the user; tools such as cinc-cli sign their requests with it."
            actions={
              created.membership === "added" ? (
                <Link href={`${base}/users/${encodeURIComponent(created.name)}`}>
                  <Button variant="ghost">View user</Button>
                </Link>
              ) : (
                <Link href={base}>
                  <Button variant="ghost">Done</Button>
                </Link>
              )
            }
          />
        ) : (
          <Link href={base}>
            <Button variant="ghost">Done</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Link href={base} className="text-sm text-muted hover:text-text">
        ← back
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">New user</h1>
      <p className="text-sm text-muted">
        Users belong to the whole server, not one organization. Only the
        superuser or a server administrator can create them.
      </p>

      <div className="space-y-1">
        <Field
          id={`${id}-username`}
          label="Username"
          value={f.username}
          onChange={set("username")}
          hint="Lowercase letters, numbers, _ and -."
          autoComplete="off"
        />
        {badUsername && (
          <p role="alert" className="text-sm text-danger">
            {explain("invalid username")}
          </p>
        )}
      </div>
      <Field id={`${id}-display`} label="Display name" value={f.display_name} onChange={set("display_name")} />
      <Field id={`${id}-first`} label="First name (optional)" value={f.first_name} onChange={set("first_name")} />
      <Field id={`${id}-last`} label="Last name (optional)" value={f.last_name} onChange={set("last_name")} />
      <Field id={`${id}-email`} label="Email" type="email" value={f.email} onChange={set("email")} />
      {authMode === "ldap" ? (
        <p className="text-sm text-muted">
          The user signs in with their directory password; the username must
          match their directory login.
        </p>
      ) : (
        <Field
          id={`${id}-password`}
          label="Password"
          type="password"
          value={f.password}
          onChange={set("password")}
          hint={`At least ${MIN_PASSWORD} characters. Used to sign in to this console.`}
          autoComplete="new-password"
        />
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">Key</legend>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="radio"
            name={`${id}-key`}
            checked={keyMode === "generate"}
            onChange={() => setKeyMode("generate")}
          />
          Generate a key pair (the private key is shown once)
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="radio"
            name={`${id}-key`}
            checked={keyMode === "paste"}
            onChange={() => setKeyMode("paste")}
          />
          Use the user&apos;s public key
        </label>
      </fieldset>
      {keyMode === "paste" && (
        <div className="space-y-1">
          <label htmlFor={`${id}-pub`} className="block text-sm text-muted">
            Public key (PEM)
          </label>
          <textarea
            id={`${id}-pub`}
            rows={8}
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            spellCheck={false}
            placeholder="-----BEGIN PUBLIC KEY-----"
            className="w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-text"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={addToOrg} onChange={(e) => setAddToOrg(e.target.checked)} />
        Add to {org} (or invite, if you can&apos;t add members directly)
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={
          pending ||
          !f.username ||
          badUsername ||
          !f.display_name.trim() ||
          !f.email.trim() ||
          (authMode !== "ldap" && f.password.length < MIN_PASSWORD) ||
          (keyMode === "paste" && !publicKey.trim())
        }
      >
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}
