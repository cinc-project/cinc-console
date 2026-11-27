"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { bootstrapNameError, settingsError, type BootstrapSettings } from "@/lib/bootstrap/validate";
import { bootstrapCliCommand, bootstrapScript } from "@/lib/bootstrap/script";
import type { BootstrapTemplate } from "@/lib/bootstrap/templates";
import { MANUAL, NodeSettings, type ManualSettings } from "./node-settings";
import { PasteOutput, SshOutput } from "./bootstrap-output";
import { CheckInStatus, type CheckInState } from "./check-in-status";
import type { CheckIn, CreateBootstrapClientResult } from "./actions";

type Path = "ssh" | "paste";

export type BootstrapFlowProps = {
  org: string;
  /** `<CINC_SERVER_URL>/organizations/<org>`, written into client.rb. */
  serverUrl: string;
  templates: BootstrapTemplate[];
  existingNodes: string[];
  existingClients: string[];
  /** null when the list couldn't be read: the field becomes free text. */
  environments: string[] | null;
  roles: string[] | null;
  policyGroups: { name: string; policies: string[] }[] | null;
  onCreate: (name: string) => Promise<CreateBootstrapClientResult>;
  onDiscard: (name: string) => Promise<{ ok: true } | { error: string }>;
  onCheckIn: (name: string) => Promise<CheckIn>;
};

const UNREACHABLE = "Couldn't reach the console. Check your connection and try again.";

function explain(error: string, name: string): string {
  if (error === "forbidden") return "You don't have permission to create clients in this organization.";
  if (error === "node exists") return `A node named ${name} already exists.`;
  if (error === "already exists") return `A client named ${name} already exists.`;
  if (error === "invalid name") return "That name isn't valid.";
  return `The Cinc server returned an error (${error}). Try again.`;
}

function manualSettings(m: ManualSettings, rolesLoaded: boolean): BootstrapSettings {
  if (m.mode === "policy") {
    return { mode: "policy", policyGroup: m.policyGroup.trim(), policyName: m.policyName.trim() };
  }
  const runList = rolesLoaded
    ? m.roles.map((r) => `role[${r}]`)
    : m.runListText.split(",").map((s) => s.trim()).filter(Boolean);
  return { mode: "roles", environment: m.environment.trim(), runList };
}

function summarize(s: BootstrapSettings): string {
  if (s.mode === "policy") return `${s.policyName || "POLICY"} from group ${s.policyGroup || "GROUP"}`;
  return `${s.runList.length ? s.runList.join(", ") : "no run list"} in ${s.environment || "?"}`;
}

function PathCard({
  pressed,
  onClick,
  title,
  badge,
  illustration,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  title: string;
  badge?: string;
  illustration: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 bg-surface p-5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link",
        pressed ? "border-link bg-surface-2" : "border-border hover:border-muted",
      )}
    >
      {illustration}
      <span className="flex items-center gap-2">
        <span className="text-base font-semibold text-text">{title}</span>
        {badge && (
          <span className="ml-auto rounded-full border border-success/40 px-2 py-0.5 text-xs text-success">
            {badge}
          </span>
        )}
      </span>
      <span className="text-sm leading-relaxed text-muted">{children}</span>
    </button>
  );
}

// Both drawings follow the design canvas ("C · Pick how you reach it").
function SshIllustration() {
  return (
    <svg viewBox="0 0 360 110" className="h-28 w-full" aria-hidden="true">
      {/* workstation */}
      <rect x="34" y="22" width="92" height="58" rx="6" className="fill-surface-2 stroke-muted" strokeWidth="2" />
      <rect x="22" y="80" width="116" height="8" rx="3" className="fill-border" />
      <path d="M52 44l10 8-10 8M68 62h20" fill="none" className="stroke-link" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* the SSH connection */}
      <path
        data-part="flow"
        d="M146 54H226"
        fill="none"
        className="stroke-link motion-safe:animate-[dash-flow_1.2s_linear_infinite]"
        strokeWidth="2.5"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
      <rect x="160" y="40" width="52" height="22" rx="11" className="fill-surface-2 stroke-border" />
      <text x="186" y="55" textAnchor="middle" className="fill-link font-mono" fontSize="11">
        ssh
      </text>
      {/* servers */}
      <rect x="240" y="18" width="88" height="30" rx="5" className="fill-surface-2 stroke-muted" strokeWidth="2" />
      <rect x="240" y="56" width="88" height="30" rx="5" className="fill-surface-2 stroke-muted" strokeWidth="2" />
      <circle cx="256" cy="33" r="3" className="fill-success" />
      <circle cx="256" cy="71" r="3" className="fill-muted" />
      <path d="M270 33h40M270 71h40" className="stroke-border" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PasteIllustration() {
  return (
    <svg viewBox="0 0 360 110" className="h-28 w-full" aria-hidden="true">
      {/* the key that goes into the script */}
      <g data-part="key">
        <rect x="44" y="40" width="40" height="32" rx="3" fill="none" className="stroke-border" strokeWidth="2" />
        <circle cx="64" cy="56" r="6" fill="none" className="stroke-warn" strokeWidth="2" />
      </g>
      {/* terminal on the machine */}
      <rect x="110" y="10" width="140" height="92" rx="8" className="fill-bg stroke-muted" strokeWidth="2" />
      <path d="M110 28h140" className="stroke-border" strokeWidth="2" />
      <circle data-part="window-dot" cx="122" cy="19" r="3" className="fill-border" />
      <circle data-part="window-dot" cx="132" cy="19" r="3" className="fill-border" />
      <circle data-part="window-dot" cx="142" cy="19" r="3" className="fill-border" />
      <path d="M124 44l8 6-8 6" fill="none" className="stroke-link" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M140 50h70M124 66h96M124 80h56" className="stroke-border" strokeWidth="3" strokeLinecap="round" />
      {/* the script */}
      <path data-part="connector" d="M258 56h14" className="stroke-link" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="278" y="34" width="52" height="44" rx="8" className="fill-surface-2 stroke-link" strokeWidth="2" />
      <path d="M294 50h20M294 58h20M294 66h12" className="stroke-link" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BootstrapFlow(props: BootstrapFlowProps) {
  const { org, templates } = props;
  const [path, setPath] = useState<Path | null>(null);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [templateKey, setTemplateKey] = useState(templates[0]?.node ?? MANUAL);
  const [manual, setManual] = useState<ManualSettings>(() => {
    const g = (props.policyGroups ?? []).find((x) => x.policies.length > 0);
    return {
      mode: "roles",
      environment: "_default",
      roles: [],
      runListText: "",
      policyGroup: g?.name ?? "",
      policyName: g?.policies[0] ?? "",
    };
  });
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckInState>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const settings: BootstrapSettings = useMemo(() => {
    const t = templates.find((x) => x.node === templateKey);
    return t ? t.settings : manualSettings(manual, props.roles !== null);
  }, [templates, templateKey, manual, props.roles]);
  const settingsProblem = settingsError(settings);

  const nameProblem: ReactNode = useMemo(() => {
    if (!trimmed) return null;
    const err = bootstrapNameError(trimmed);
    if (err) return err;
    if (privateKey) return null; // it's ours now
    if (props.existingNodes.includes(trimmed)) {
      return (
        <>
          A node named{" "}
          <Link href={`/orgs/${org}/nodes/${encodeURIComponent(trimmed)}`} className="underline">
            {trimmed}
          </Link>{" "}
          already exists.
        </>
      );
    }
    if (props.existingClients.includes(trimmed)) {
      return (
        <>
          A client named{" "}
          <Link href={`/orgs/${org}/clients/${encodeURIComponent(trimmed)}`} className="underline">
            {trimmed}
          </Link>{" "}
          already exists.
        </>
      );
    }
    return null;
  }, [trimmed, privateKey, props.existingNodes, props.existingClients, org]);

  const ready = trimmed !== "" && !nameProblem && !settingsProblem;

  const cliLines = useMemo(
    // An empty host targets the node name, the usual case of name = hostname.
    () =>
      ready
        ? bootstrapCliCommand({ host: host.trim() || trimmed, nodeName: trimmed, settings })
        : null,
    [ready, host, trimmed, settings],
  );
  const script = useMemo(
    () =>
      privateKey
        ? bootstrapScript({
            nodeName: trimmed,
            serverUrl: props.serverUrl,
            clientKeyPem: privateKey,
            settings,
          })
        : null,
    [privateKey, trimmed, props.serverUrl, settings],
  );

  const onState = useCallback((s: CheckInState) => setCheckIn(s), []);
  // Focus moves to the watch status once, when "I've run it" replaces itself
  // with it; a later remount (the name was edited) must not steal focus.
  const [focusWatch, setFocusWatch] = useState(false);
  const onWatchFocused = useCallback(() => setFocusWatch(false), []);

  function choosePath(p: Path) {
    if (privateKey) return; // a created client pins the paste path
    setPath(p);
    setWatching(false);
    setError(null);
  }

  function create() {
    setError(null);
    startTransition(async () => {
      let res: CreateBootstrapClientResult;
      try {
        res = await props.onCreate(trimmed);
      } catch {
        setError(UNREACHABLE);
        return;
      }
      if ("ok" in res) {
        setPrivateKey(res.privateKey);
        setCheckIn("waiting");
        setWatching(true);
      } else {
        setError(explain(res.error, trimmed));
      }
    });
  }

  function discard() {
    setError(null);
    startTransition(async () => {
      let res: { ok: true } | { error: string };
      try {
        res = await props.onDiscard(trimmed);
      } catch {
        setError(UNREACHABLE);
        return;
      }
      if ("ok" in res) {
        setPrivateKey(null);
        setWatching(false);
      } else if (res.error === "node exists") {
        setError("The node has already checked in, so its client stays. Delete the node to remove both.");
      } else {
        setError(explain(res.error, trimmed));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div role="group" aria-label="How will you reach the machine?" className="grid gap-4 md:grid-cols-2">
        <PathCard
          pressed={path === "ssh"}
          onClick={() => choosePath("ssh")}
          title="I can SSH to it"
          badge="Recommended"
          illustration={<SshIllustration />}
        >
          Run one Cinc CLI command from your workstation. It creates the client and key, installs
          Cinc Client over SSH, and does the first run. No secrets pass through this page.
        </PathCard>
        <PathCard
          pressed={path === "paste"}
          onClick={() => choosePath("paste")}
          title="I'm on the machine"
          illustration={<PasteIllustration />}
        >
          Copy a script and paste it into a shell on the machine. The new client key is inside
          the script, so it&apos;s shown only once.
        </PathCard>
      </div>

      {path && (
        <>
          <NodeSettings
            path={path}
            locked={privateKey !== null}
            name={name}
            onName={setName}
            nameError={nameProblem}
            host={host}
            onHost={setHost}
            templates={templates}
            templateKey={templateKey}
            onTemplate={setTemplateKey}
            summary={summarize(settings)}
            settingsError={settingsProblem}
            modeLabel={settings.mode === "policy" ? "Policyfile" : "Roles + environment"}
            manual={manual}
            onManual={(patch) => setManual((m) => ({ ...m, ...patch }))}
            environments={props.environments}
            roles={props.roles}
            policyGroups={props.policyGroups}
          />

          <section aria-label="Bootstrap" className="space-y-4">
            {path === "ssh" ? (
              <SshOutput
                lines={cliLines}
                missing={ready ? null : nameProblem || !trimmed ? "name" : "settings"}
                serverUrl={props.serverUrl}
                watching={watching}
                onWatch={() => {
                  setWatching(true);
                  setFocusWatch(true);
                }}
              />
            ) : (
              <PasteOutput
                name={trimmed}
                script={script}
                canCreate={ready}
                pending={pending}
                error={error}
                canDiscard={checkIn === "waiting"}
                onCreate={create}
                onDiscard={discard}
              />
            )}
            {watching && trimmed && !nameProblem && (
              // Keyed by name: an edited name starts a fresh watch, never
              // showing the previous name's result.
              <CheckInStatus
                key={trimmed}
                org={org}
                name={trimmed}
                check={props.onCheckIn}
                onState={onState}
                focusOnMount={focusWatch}
                onFocused={onWatchFocused}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
