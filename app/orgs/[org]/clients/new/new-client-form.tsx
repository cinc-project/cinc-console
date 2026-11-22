"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { nameError } from "@/lib/cinc/names";
import { OneTimeKey } from "@/components/one-time-key";
import type { CreateClientResult } from "../actions";

function explain(error: string): string {
  if (error === "forbidden")
    return "You don't have permission to create clients in this organization.";
  if (error === "already exists")
    return "A client with that name already exists.";
  return error;
}

export function NewClientForm({
  org,
  onCreate,
}: {
  org: string;
  onCreate: (name: string) => Promise<CreateClientResult>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; privateKey: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const nameErr = nameError("client", name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setError(null);
    startTransition(async () => {
      const res = await onCreate(n);
      if ("ok" in res) setCreated({ name: n, privateKey: res.privateKey });
      else setError(explain(res.error));
    });
  }

  if (created) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Client <span className="font-mono">{created.name}</span> created
        </h1>

        <OneTimeKey
          filename={created.name}
          privateKey={created.privateKey}
          label={`Private key for ${created.name}`}
          hint="Store it where the client (e.g. chef-client) can read it."
          actions={
            <Link href={`/orgs/${org}/clients`}>
              <Button variant="ghost">Done</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Link
        href={`/orgs/${org}/clients`}
        className="text-sm text-muted hover:text-text"
      >
        ← back
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">New client</h1>

      <div className="space-y-1">
        <label htmlFor="client-name" className="block text-sm text-muted">
          Name
        </label>
        <Input
          id="client-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
          autoFocus
          aria-invalid={nameErr ? true : undefined}
          aria-describedby={nameErr ? "client-name-error" : undefined}
        />
        {nameErr && (
          <p id="client-name-error" role="alert" className="text-sm text-danger">
            {nameErr}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending || !name.trim() || !!nameErr}>
        {pending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
