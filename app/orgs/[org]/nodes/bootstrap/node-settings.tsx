"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BootstrapTemplate } from "@/lib/bootstrap/templates";

/** The hand-picked settings behind "Choose manually". */
export type ManualSettings = {
  mode: "roles" | "policy";
  environment: string;
  /** Picked roles, when the roles list loaded. */
  roles: string[];
  /** Comma-separated run list, when it didn't. */
  runListText: string;
  policyGroup: string;
  policyName: string;
};

export const MANUAL = "manual";

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
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-1 rounded-md border border-border bg-bg p-1"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-9 rounded px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            value === o.id ? "bg-primary text-primary-foreground" : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  templateKey,
  onTemplate,
  summary,
  modeLabel,
  manual,
  onManual,
  environments,
  roles,
  policyGroups,
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
  templateKey: string;
  onTemplate: (v: string) => void;
  summary: string;
  modeLabel: string;
  manual: ManualSettings;
  onManual: (patch: Partial<ManualSettings>) => void;
  environments: string[] | null;
  roles: string[] | null;
  policyGroups: { name: string; policies: string[] }[] | null;
}) {
  const id = useId();
  const roleTemplates = templates.filter((t) => t.settings.mode === "roles");
  const policyTemplates = templates.filter((t) => t.settings.mode === "policy");
  const pinnedGroups = (policyGroups ?? []).filter((g) => g.policies.length > 0);
  const policiesInGroup = pinnedGroups.find((g) => g.name === manual.policyGroup)?.policies ?? [];
  const envOptions = ["_default", ...(environments ?? []).filter((e) => e !== "_default")];

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="space-y-5 rounded-lg border border-border bg-surface p-5"
    >
      <h2 id={`${id}-heading`} className="text-base font-semibold">
        About the node
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            aria-describedby={nameError ? `${id}-name-error` : undefined}
          />
        </Field>

        {path === "ssh" && (
          <Field id={`${id}-host`} label="Host or IP" hint="Leave empty to fill it in yourself.">
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

        <Field id={`${id}-like`} label="Set it up like">
          <select
            id={`${id}-like`}
            value={templateKey}
            onChange={(e) => onTemplate(e.target.value)}
            disabled={locked}
            className={selectClass}
          >
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
            <option value={MANUAL}>Choose manually</option>
          </select>
        </Field>
      </div>

      {templateKey === MANUAL && (
        <div className="space-y-4 rounded-md border border-border p-4">
          <Segmented
            label="Configured with"
            value={manual.mode}
            disabled={locked}
            onChange={(mode) => onManual({ mode })}
            options={[
              { id: "roles", label: "Roles + environment" },
              { id: "policy", label: "Policyfile" },
            ]}
          />

          {manual.mode === "roles" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-env`} label="Environment">
                {environments ? (
                  <select
                    id={`${id}-env`}
                    value={manual.environment}
                    onChange={(e) => onManual({ environment: e.target.value })}
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
                    value={manual.environment}
                    onChange={(e) => onManual({ environment: e.target.value })}
                    disabled={locked}
                    className="font-mono"
                  />
                )}
              </Field>
              {roles ? (
                <fieldset className="space-y-1">
                  <legend className="text-sm text-muted">Roles</legend>
                  {roles.length === 0 ? (
                    <p className="text-sm text-muted">No roles yet: the node starts with an empty run list.</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {roles.map((r) => (
                        <label key={r} className="inline-flex min-h-9 items-center gap-2 font-mono text-sm">
                          <input
                            type="checkbox"
                            checked={manual.roles.includes(r)}
                            disabled={locked}
                            onChange={(e) =>
                              onManual({
                                roles: e.target.checked
                                  ? [...manual.roles, r]
                                  : manual.roles.filter((x) => x !== r),
                              })
                            }
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          {r}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              ) : (
                <Field
                  id={`${id}-runlist`}
                  label="Run list"
                  hint="Comma-separated, e.g. role[base], recipe[apt]"
                >
                  <Input
                    id={`${id}-runlist`}
                    value={manual.runListText}
                    onChange={(e) => onManual({ runListText: e.target.value })}
                    disabled={locked}
                    className="font-mono"
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {policyGroups !== null && pinnedGroups.length === 0 && (
                <p className="text-sm text-muted">
                  No policy is pinned to a policy group yet. Push one with{" "}
                  <code className="font-mono">cinc policy push GROUP</code>, or type the names.
                </p>
              )}
              <p className="text-xs text-muted">
                Policyfile nodes have no environment or run list. The policy group picks the
                revision they run.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${id}-group`} label="Policy group">
                  {pinnedGroups.length > 0 ? (
                    <select
                      id={`${id}-group`}
                      value={manual.policyGroup}
                      onChange={(e) => {
                        const g = pinnedGroups.find((x) => x.name === e.target.value);
                        onManual({ policyGroup: e.target.value, policyName: g?.policies[0] ?? "" });
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
                  ) : (
                    <Input
                      id={`${id}-group`}
                      value={manual.policyGroup}
                      onChange={(e) => onManual({ policyGroup: e.target.value })}
                      disabled={locked}
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field id={`${id}-policy`} label="Policy">
                  {pinnedGroups.length > 0 ? (
                    <select
                      id={`${id}-policy`}
                      value={manual.policyName}
                      onChange={(e) => onManual({ policyName: e.target.value })}
                      disabled={locked}
                      className={selectClass}
                    >
                      {policiesInGroup.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`${id}-policy`}
                      value={manual.policyName}
                      onChange={(e) => onManual({ policyName: e.target.value })}
                      disabled={locked}
                      className="font-mono"
                    />
                  )}
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text">
          {modeLabel}
        </span>
        Gets <span className="font-mono text-text">{summary}</span>
      </p>
    </section>
  );
}
