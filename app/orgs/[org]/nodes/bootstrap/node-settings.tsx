"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { BootstrapTemplate } from "@/lib/bootstrap/templates";
import { RunListEditor } from "./run-list-editor";

/**
 * What the user is editing. Both modes' values are kept, so switching modes
 * and back loses nothing; only the chosen mode's half becomes the settings.
 */
export type Draft = {
  mode: "roles" | "policy";
  environment: string;
  runList: string[];
  policyGroup: string;
  policyName: string;
};

export type PolicyGroupOption = { name: string; policies: { name: string; revision: string }[] };

const selectClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A native radio dressed as a card; the whole card is its label. */
function RadioCard({
  name,
  checked,
  onChange,
  disabled,
  title,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border-2 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
        checked ? "border-link bg-surface-2" : "border-border hover:border-muted",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)] focus-visible:outline-none"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-medium text-text">{title}</span>
        {children && <span className="text-sm text-muted">{children}</span>}
      </span>
    </label>
  );
}

export function NodeSettings({
  path,
  locked,
  name,
  onName,
  nameError,
  host,
  onHost,
  templates,
  copiedFrom,
  onCopy,
  draft,
  onDraft,
  environments,
  roles,
  cookbooks,
  policyGroups,
  summary,
  settingsError,
}: {
  path: "ssh" | "paste";
  /** After the client is created, the settings are baked into the script. */
  locked: boolean;
  name: string;
  onName: (v: string) => void;
  nameError: ReactNode;
  host: string;
  onHost: (v: string) => void;
  templates: BootstrapTemplate[];
  copiedFrom: string;
  onCopy: (node: string) => void;
  draft: Draft;
  onDraft: (patch: Partial<Draft>) => void;
  environments: string[] | null;
  roles: string[] | null;
  cookbooks: string[] | null;
  policyGroups: PolicyGroupOption[] | null;
  summary: string;
  /** Shown instead of the summary while the settings can't be used. */
  settingsError: string | null;
}) {
  const id = useId();
  const roleTemplates = templates.filter((t) => t.settings.mode === "roles");
  const policyTemplates = templates.filter((t) => t.settings.mode === "policy");
  const pinnedGroups = (policyGroups ?? []).filter((g) => g.policies.length > 0);
  const policiesInGroup = pinnedGroups.find((g) => g.name === draft.policyGroup)?.policies ?? [];
  const envOptions = ["_default", ...(environments ?? []).filter((e) => e !== "_default")];
  const shownName = name.trim() || "this node";

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-6 rounded-lg border border-border bg-surface p-5">
      <h2 id={`${id}-heading`} className="text-base font-semibold">
        About the node
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${id}-name`}
          label="Name"
          error={nameError}
          hint="Usually the machine's hostname. It's also the API client's name."
        >
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => onName(e.target.value)}
            disabled={locked}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : `${id}-name-hint`}
          />
        </Field>
        {path === "ssh" && (
          <Field id={`${id}-host`} label="Host or IP" hint="Leave empty to use the name.">
            <Input
              id={`${id}-host`}
              value={host}
              onChange={(e) => onHost(e.target.value)}
              placeholder={name || "HOST"}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        )}
      </div>

      <div className="space-y-4 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold">
            What should <span className="font-mono">{shownName}</span> run?
          </h3>
          {templates.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor={`${id}-copy`} className="whitespace-nowrap text-sm text-muted">
                Copy from a node
              </label>
              <select
                id={`${id}-copy`}
                value={copiedFrom}
                onChange={(e) => onCopy(e.target.value)}
                disabled={locked}
                className={cn(selectClass, "w-48")}
              >
                <option value="">Choose…</option>
                {roleTemplates.length > 0 && (
                  <optgroup label="Roles + environment">
                    {roleTemplates.map((t) => (
                      <option key={t.node} value={t.node}>
                        {t.node}
                      </option>
                    ))}
                  </optgroup>
                )}
                {policyTemplates.length > 0 && (
                  <optgroup label="Policyfile">
                    {policyTemplates.map((t) => (
                      <option key={t.node} value={t.node}>
                        {t.node}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
        </div>
        {copiedFrom && (
          <p role="status" className="text-sm text-muted">
            Copied from <span className="font-mono text-text">{copiedFrom}</span>. Change anything
            below; the copy is only a starting point.
          </p>
        )}

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">How this node is managed</legend>
          <RadioCard
            name={`${id}-mode`}
            checked={draft.mode === "roles"}
            onChange={() => onDraft({ mode: "roles" })}
            disabled={locked}
            title="Roles + environment"
          >
            An ordered run list of roles and recipes, in an environment.
          </RadioCard>
          <RadioCard
            name={`${id}-mode`}
            checked={draft.mode === "policy"}
            onChange={() => onDraft({ mode: "policy" })}
            disabled={locked}
            title="Policyfile"
          >
            A policy pinned to a policy group. No environment or run list.
          </RadioCard>
        </fieldset>

        {draft.mode === "roles" ? (
          <div className="grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <Field id={`${id}-env`} label="Environment">
              {environments ? (
                <select
                  id={`${id}-env`}
                  value={draft.environment}
                  onChange={(e) => onDraft({ environment: e.target.value })}
                  disabled={locked}
                  className={selectClass}
                >
                  {envOptions.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`${id}-env`}
                  value={draft.environment}
                  onChange={(e) => onDraft({ environment: e.target.value })}
                  disabled={locked}
                  className="font-mono"
                />
              )}
            </Field>
            <RunListEditor
              entries={draft.runList}
              onChange={(runList) => onDraft({ runList })}
              roles={roles}
              cookbooks={cookbooks}
              disabled={locked}
            />
          </div>
        ) : pinnedGroups.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <Field id={`${id}-group`} label="Policy group" hint="Takes the place of an environment.">
              <select
                id={`${id}-group`}
                value={draft.policyGroup}
                onChange={(e) => {
                  const g = pinnedGroups.find((x) => x.name === e.target.value);
                  onDraft({ policyGroup: e.target.value, policyName: g?.policies[0]?.name ?? "" });
                }}
                disabled={locked}
                className={selectClass}
              >
                {pinnedGroups.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm text-muted">
                Policy <span className="text-xs">· pinned in {draft.policyGroup}</span>
              </legend>
              {policiesInGroup.map((p) => (
                <RadioCard
                  key={p.name}
                  name={`${id}-policy`}
                  checked={draft.policyName === p.name}
                  onChange={() => onDraft({ policyName: p.name })}
                  disabled={locked}
                  title={
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono">{p.name}</span>
                      <span className="text-xs font-normal text-muted">
                        revision <span className="font-mono">{p.revision.slice(0, 12)}</span>
                      </span>
                    </span>
                  }
                />
              ))}
            </fieldset>
          </div>
        ) : (
          <div className="space-y-3">
            {policyGroups !== null && (
              <p className="text-sm text-muted">
                No policy is pinned to a policy group yet. Push one with{" "}
                <code className="font-mono">cinc policy push GROUP</code>, or type the names.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-group`} label="Policy group">
                <Input
                  id={`${id}-group`}
                  value={draft.policyGroup}
                  onChange={(e) => onDraft({ policyGroup: e.target.value })}
                  disabled={locked}
                  className="font-mono"
                />
              </Field>
              <Field id={`${id}-policy`} label="Policy">
                <Input
                  id={`${id}-policy`}
                  value={draft.policyName}
                  onChange={(e) => onDraft({ policyName: e.target.value })}
                  disabled={locked}
                  className="font-mono"
                />
              </Field>
            </div>
          </div>
        )}

        {settingsError ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <span aria-hidden="true">
              <IconWarning />
            </span>
            {settingsError}
          </p>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted">
            First run: <span className="font-mono text-text">{summary}</span>
          </p>
        )}
      </div>
    </section>
  );
}
