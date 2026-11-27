# Bootstrap a Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "New → JSON" on the Nodes list with a "Bootstrap a node" page (direction C): pick SSH or on-the-machine, describe the node (roles+environment or Policyfile), get a `cinc node bootstrap` command or a paste script, and watch for the first check-in.

**Architecture:** Pure, client-safe builders in `lib/bootstrap/` (name/run-list validation, a byte-faithful TS port of cinc-cli's `BootstrapCommand`, the CLI command line, templates from fleet nodes). A server page loads pickers' data; one client component renders the flow and rebuilds output live. Three server actions: create the client (paste path only), discard it (only before the node exists), and poll check-in. The node itself is created by the machine's first run, as in cinc-cli.

**Tech Stack:** Next.js 16 (App Router, server actions), React, Tailwind tokens from `app/globals.css`, Vitest + Testing Library + `@/test/axe`, Playwright e2e against cinc-server-ng.

**Spec:** `docs/superpowers/specs/2026-11-26-node-bootstrap-design.md`

## Global Constraints

- User-facing copy says **Cinc**, never "Chef Server"; no knife commands on the bootstrap page.
- `lib/cinc/*` stays server-only; `lib/bootstrap/*` must NOT import `server-only` (the client component uses it).
- Every server action validates its `unknown` arguments; only `.bind(null, org)` args are trusted. Paths via `` cincPath`…` ``.
- Mutations return `{ ok: true } | { error: string }` style results; 403 → `"forbidden"`.
- Policy mode never emits an environment: no `chef_environment` in `first-boot.json`, no `--environment` flag.
- The private key is never logged, persisted, or sent anywhere but the browser that created it.
- WCAG 2.2 AA: path cards are `<button aria-pressed>`, status via `role="status"`, warnings icon + text, `prefers-reduced-motion` respected, everything keyboard-operable.
- Server-side tests start with `// @vitest-environment node`; mock `"use server"` imports with `vi.hoisted`.
- Run `make check` before each commit. Commit messages credit only the author (no Claude/AI trailers or mentions).

## Review Focus

1. **Server key with a trailing newline**: `createClient` returns PEM ending in `\n`; the script must still be valid (cinc-cli writes content verbatim, which adds a blank line before `CINC_EOF`; keep that, don't trim, so parity holds). Test in Task 2.
2. **Name valid for a node but not a client** (`a:b`): rejected by the page and the action with a message, before any request. Tests in Tasks 1 and 4.
3. **Copying a node whose run list has a pinned or namespaced recipe** (`recipe[apt::default@1.2.3]`): accepted and reproduced exactly. Test in Task 1.
4. **Policy group with no pinned policies, or no policy groups at all**: the Policyfile option shows an explanatory empty state instead of an empty select; a template from a policy node still works. Test in Task 6.
5. **Picker data forbidden (403)**: environments/roles/policy-groups lists that fail fall back to free-text inputs validated with the same rules, the page still renders. Test in Task 6.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/cinc/names.ts` (modify) | add `policy_group`, `policy_name` kinds |
| `lib/bootstrap/validate.ts` | `bootstrapNameError`, `runListEntryError`, `BootstrapSettings` type + `settingsError` |
| `lib/bootstrap/script.ts` | `bootstrapScript()` port of cinc-cli `BootstrapCommand`; `bootstrapCliCommand()` |
| `lib/bootstrap/templates.ts` | `templatesFromFleet()` — "Set it up like" options |
| `lib/bootstrap/__fixtures__/{roles,policy,empty}.sh` | golden output from cinc-cli (already generated, see Task 2) |
| `components/command-line.tsx` | `CommandLine` placeholder highlighter extracted from `CommandSnippet` |
| `app/orgs/[org]/nodes/bootstrap/actions.ts` | `createBootstrapClient`, `discardBootstrapClient`, `nodeCheckIn` |
| `app/orgs/[org]/nodes/bootstrap/page.tsx` | loads data, renders `BootstrapFlow` |
| `app/orgs/[org]/nodes/bootstrap/bootstrap-flow.tsx` | top-level client component: path cards + state |
| `app/orgs/[org]/nodes/bootstrap/node-settings.tsx` | name/host/"set it up like"/manual pickers |
| `app/orgs/[org]/nodes/bootstrap/bootstrap-output.tsx` | SSH command panel and paste create/script panel |
| `app/orgs/[org]/nodes/bootstrap/check-in-status.tsx` | polling watcher |
| `components/nodes-table.tsx` (modify) | header button + ⋯ menu; empty state |
| `e2e/bootstrap.spec.ts`, `e2e/nodes.spec.ts` (modify) | end-to-end |

---

### Task 1: Name and run-list validation

**Files:**
- Modify: `lib/cinc/names.ts`, `lib/cinc/names.test.ts`
- Create: `lib/bootstrap/validate.ts`, `lib/bootstrap/validate.test.ts`

**Interfaces:**
- Produces:
  - `NameKind` gains `"policy_group" | "policy_name"`, pattern `/^[.:\-A-Za-z0-9_]+$/`, hint `"letters, numbers, and . : _ -"`.
  - `bootstrapNameError(raw: string): string | null` — non-empty trimmed name must pass `nameError("node")` and `nameError("client")`; empty → `"Enter a name."`; node-only failure (e.g. `:`) → `"Use only letters, numbers, and . _ - (the name is also the client's)."`
  - `runListEntryError(entry: string): string | null`.
  - `type BootstrapSettings = { mode: "roles"; environment: string; runList: string[] } | { mode: "policy"; policyGroup: string; policyName: string }`
  - `settingsError(s: BootstrapSettings): string | null` — first error among environment (`nameError("environment")` but `_default` allowed), each run-list entry, policy group/name (must be non-empty).

- [ ] **Step 1: Write failing tests** in `validate.test.ts`:
  - `bootstrapNameError("web01") === null`; `bootstrapNameError("a:b")` contains `"also the client"`; `bootstrapNameError("")` is `"Enter a name."`; `bootstrapNameError("web 01")` non-null.
  - `runListEntryError` returns null for each of `role[base]`, `recipe[apt]`, `recipe[apt::default]`, `recipe[apt@1.2.3]`, `recipe[apt::default@1.2]`, `recipe[my-cb_2]`; non-null for `role[base`, `role[a.b]`, `base`, `recipe[]`, `recipe[apt@x]`, `role[base]; rm -rf /`, `recipe[a]\nrecipe[b]`.
  - `settingsError({ mode: "roles", environment: "_default", runList: [] }) === null`; bad env `"pro d"` non-null; `{ mode: "policy", policyGroup: "prod", policyName: "" }` non-null.
  - In `names.test.ts`: `nameError("policy_group", "prod") === null`, `nameError("policy_name", "web app")` non-null.
- [ ] **Step 2: Run** `pnpm test validate names` — FAIL (module/kind missing).
- [ ] **Step 3: Implement.** Run-list regex:
  `/^(role\[[\-A-Za-z0-9_]+\]|recipe\[[\-A-Za-z0-9_.]+(::[\-A-Za-z0-9_.]+)?(@\d+(\.\d+){0,2})?\])$/`
- [ ] **Step 4: Run** `pnpm test validate names` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Add bootstrap name and run-list validation"`

---

### Task 2: Bootstrap script and CLI command builders

**Files:**
- Create: `lib/bootstrap/script.ts`, `lib/bootstrap/script.test.ts`
- Fixtures (already in the tree, uncommitted): `lib/bootstrap/__fixtures__/roles.sh`, `policy.sh`, `empty.sh` — produced by cinc-cli `cli/remote.BootstrapCommand` (commit 154aad5) with `NodeName "web01"`, `ServerURL "https://cinc.example.test/organizations/acme"`, `ClientKeyPEM "-----BEGIN RSA PRIVATE KEY-----\nTESTKEYLINE1\nTESTKEYLINE2\n-----END RSA PRIVATE KEY-----"`, `Sudo true`, and respectively: `RunList ["role[base]","recipe[apt@1.2.3]"], Environment "production"`; `PolicyName "media", PolicyGroup "prod"`; nothing (environment defaults to `_default`). Files have no trailing newline.

**Interfaces:**
- Consumes: `BootstrapSettings`, `bootstrapNameError`, `settingsError` (Task 1).
- Produces:
  - `bootstrapScript(o: { nodeName: string; serverUrl: string; clientKeyPem: string; settings: BootstrapSettings }): string` — throws `Error` on invalid name/settings, a newline in `serverUrl`, or any content line equal to `CINC_EOF`.
  - `bootstrapCliCommand(o: { host: string; nodeName: string; settings: BootstrapSettings }): string[]` — lines for display/copy; host `""` → `HOST`; `--ssh-user USER` always (placeholder).

- [ ] **Step 1: Write failing tests:**
  - `bootstrapScript({...fixture inputs...})` equals each fixture file's contents exactly (`readFileSync`, three cases; `settings` for the empty case is `{ mode: "roles", environment: "_default", runList: [] }`).
  - Key ending in `"\n"` → script contains `"-----END RSA PRIVATE KEY-----\n\nCINC_EOF"` (verbatim, matching cinc-cli).
  - Policy settings → output has no `chef_environment`.
  - Throws for nodeName `"a:b"`, serverUrl containing `"\n"`, key containing a line `CINC_EOF`.
  - `bootstrapCliCommand({ host: "10.0.0.5", nodeName: "web01", settings: { mode: "roles", environment: "production", runList: ["role[base]","recipe[apt]"] } })` →
    `["cinc node bootstrap 10.0.0.5 --ssh-user USER --node-name web01", "  --environment production --run-list 'role[base],recipe[apt]'"]`
  - Policy → second line `"  --policy-group prod --policy-name media"`; roles with empty run list → second line `"  --environment _default"`; host `""` → first line starts `cinc node bootstrap HOST`.
- [ ] **Step 2: Run** `pnpm test script` — FAIL.
- [ ] **Step 3: Implement** as a port of `cli/remote/bootstrap.go` in `/Users/tsmith/dev/oss/cinc-cli` (read it): `set -e`, mktemp installer + trap, `curl -fsSL '<url>' -o`, `sudo bash`, `sudo mkdir -p /etc/cinc`, `sudo install -m 0600 /dev/null /etc/cinc/client.pem`, key heredoc, `sudo chmod 0600 /etc/cinc/client.pem`, `client.rb` heredoc (`chef_server_url`/`node_name`/`client_key`, Ruby single-quote escaping of `\` and `'`, trailing `\n` → blank line), `first-boot.json` heredoc, `sudo cinc-client -j /etc/cinc/first-boot.json`. `first-boot.json` = `JSON.stringify(doc, null, 2)` with keys inserted in **alphabetical order** (Go map marshalling): `chef_environment`, `policy_group`, `policy_name`, `run_list`; `run_list` only when non-empty; `chef_environment` only in roles mode. Shell quoting: `'` + replace `'` with `'"'"'` + `'`.
- [ ] **Step 4: Run** `pnpm test script` — PASS.
- [ ] **Step 5: Commit** (include fixtures) `git commit -m "Port cinc-cli's bootstrap script for paste-in bootstrap"`

---

### Task 3: Shared command-line highlighter

**Files:**
- Create: `components/command-line.tsx`, `components/command-line.test.tsx`
- Modify: `components/command-snippet.tsx` (use it; remove its local `PLACEHOLDER`/`renderLine`)

**Interfaces:**
- Produces: `CommandLine({ line }: { line: string })` — renders text with `/\b([A-Z][A-Z_]{2,})\b/` matches in `<span className="font-semibold text-text">`.

- [ ] **Step 1: Failing test:** rendering `cinc node bootstrap HOST --ssh-user USER` puts `HOST` and `USER` in elements with class `font-semibold`; `cinc` is not.
- [ ] **Step 2: Run** `pnpm test command-line` — FAIL.
- [ ] **Step 3: Implement** by moving the existing logic; `CommandSnippet` maps lines through `<CommandLine>`.
- [ ] **Step 4: Run** `pnpm test command-` — both `command-line` and `command-snippet` tests PASS.
- [ ] **Step 5: Commit** `git commit -m "Extract the command placeholder highlighter"`

---

### Task 4: Server actions

**Files:**
- Create: `app/orgs/[org]/nodes/bootstrap/actions.ts`, `actions.test.ts`

**Interfaces:**
- Consumes: `bootstrapNameError` (Task 1); `createClient`, `deleteClient` (`lib/cinc/clients.ts`); `makeResource("nodes")`; `isCincError`; `requireUser`.
- Produces (`"use server"`):
  - `createBootstrapClient(org: string, name: unknown): Promise<{ ok: true; privateKey: string } | { error: string }>` — errors: `"invalid name"`, `"node exists"` (GET node succeeds), `"already exists"` (409 on create), `"forbidden"`, `"server error (N)"`. Revalidates `/orgs/${org}/clients`.
  - `discardBootstrapClient(org: string, name: unknown): Promise<{ ok: true } | { error: string }>` — `"invalid name"`; `"node exists"` if the node exists (client kept); otherwise delete client, 404 counts as ok; 403 → `"forbidden"`.
  - `nodeCheckIn(org: string, name: unknown): Promise<{ state: "waiting" } | { state: "registered" } | { state: "checked-in"; ohaiTime: number; platform: string | null } | { error: string }>` — node 404 → waiting; node without `automatic.ohai_time` → registered; with it → checked-in, `platform` = `"<automatic.platform> <automatic.platform_version>"` trimmed or null.

- [ ] **Step 1: Failing tests** (node env, `vi.hoisted` mocks of `@/lib/session`, `@/lib/cinc/clients`, `@/lib/cinc/resource`):
  - create: valid name + node 404 → calls `createClient(user, org, "web01")`, returns key; node GET 200 → `{ error: "node exists" }` and `createClient` not called; `"a:b"` and `42` → `{ error: "invalid name" }` with no request; create throws 409 → `"already exists"`; 403 → `"forbidden"`.
  - discard: node 404 → `deleteClient` called, ok; node 200 → `{ error: "node exists" }`, `deleteClient` not called; delete 404 → ok.
  - check-in: three states as above; `platform: "ubuntu 24.04"`.
- [ ] **Step 2: Run** `pnpm test nodes/bootstrap/actions` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Add bootstrap server actions"`

---

### Task 5: "Set it up like" templates

**Files:**
- Create: `lib/bootstrap/templates.ts`, `templates.test.ts`

**Interfaces:**
- Consumes: `FleetNode` (`lib/cinc/fleet.ts`), `BootstrapSettings`, `settingsError`.
- Produces: `type BootstrapTemplate = { node: string; settings: BootstrapSettings; summary: string }` and `templatesFromFleet(nodes: FleetNode[]): BootstrapTemplate[]` — policy mode when `policyName` and `policyGroup` are both set; else roles mode with `environment ?? "_default"` and `runList`; drops nodes whose settings fail `settingsError`; sorted by node name. `summary`: roles → `"role[base], recipe[apt] in production"` (empty list → `"no run list in production"`); policy → `"web-app from group production"`.

- [ ] **Step 1: Failing tests** with `seed-web01`-like and `seed-policy01`-like nodes (see `e2e/fixtures/state/organizations/acme/nodes/`): modes, summaries, a node with run list `["bogus"]` dropped, sort order.
- [ ] **Step 2: Run** `pnpm test templates` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Derive bootstrap templates from existing nodes"`

---

### Task 6: Bootstrap page and flow UI

**Files:**
- Create: `app/orgs/[org]/nodes/bootstrap/page.tsx`, `bootstrap-flow.tsx`, `node-settings.tsx`, `bootstrap-output.tsx`, `check-in-status.tsx`, and `bootstrap-flow.test.tsx`

**Interfaces:**
- Consumes: everything above; `fetchFleetNodes` (`lib/cinc/search.ts`), `listPolicyGroups` (`lib/cinc/policy-groups.ts`), `makeResource("environments"|"roles").list`, `clients.list` (`lib/cinc/readonly.ts`), `safeGet`, `getConfig().serverUrl`, `currentUser`, `PageHeader`, `Button`, `Input`, `CopyButton`, `CommandLine`.
- Produces: `BootstrapFlow` props
  ```ts
  type BootstrapFlowProps = {
    org: string;
    serverUrl: string;                 // `${getConfig().serverUrl}/organizations/${org}`
    templates: BootstrapTemplate[];
    takenNames: string[];              // node names ∪ client names
    environments: string[] | null;     // null = couldn't load → free text
    roles: string[] | null;
    policyGroups: { name: string; policies: string[] }[] | null;
    onCreate: (name: string) => Promise<{ ok: true; privateKey: string } | { error: string }>;
    onDiscard: (name: string) => Promise<{ ok: true } | { error: string }>;
    onCheckIn: (name: string) => ReturnType<typeof nodeCheckIn>;
  };
  ```
  Page binds actions with `.bind(null, org)`. Each list loads with `safeGet`; an error maps to `null` (fleet/clients errors → empty arrays). Title `"Bootstrap a node"`, breadcrumb back to Nodes.

Behavior (copy from the spec and the canvas mockup "C · Pick how you reach it"):
- Two `<button aria-pressed>` cards: **"I can SSH to it"** (badge "Recommended") and **"I'm on the machine"**; nothing below until one is picked.
- Settings: Name (error from `bootstrapNameError`, or `"A node or client named X already exists."` with a link to it when in `takenNames`); Host or IP (SSH only, placeholder = name); "Set it up like" `<select>` with `<optgroup>`s "Roles + environment" / "Policyfile" plus "Choose manually"; summary line with a text mode badge. Manual: segmented "Roles + environment" / "Policyfile" switch; roles mode = environment select (free text if `null`) + role checkboxes (free-text comma list if `null`); policy mode = group select then policy select (policies pinned in that group); if no groups/pins → text "No policy is pinned to a policy group yet. Push one with `cinc policy push GROUP`." and free-text fields.
- SSH output: heading "Run on your workstation", `<pre>` of `bootstrapCliCommand` lines via `CommandLine`, CopyButton, note "First time on this workstation? Run `cinc config create`." Starts the check-in watcher once a valid name is entered and the user clicks **"I've run it"**.
- Paste output: button **"Create client and show script"** (disabled while settings/name invalid) → `onCreate`; on error show `role="alert"` (`forbidden` → "You don't have permission to create clients in this organization."; `node exists`/`already exists` → name-taken message). On success: heading "Paste on the machine, in a shell where you can sudo", `<pre aria-label="Bootstrap script">` of `bootstrapScript`, Copy + Download `bootstrap-<name>.sh`, warning (icon + text) "This script contains the new client key and is shown only once.", **Discard** (calls `onDiscard`, returns to the pre-create state). Settings and name lock after create. The watcher starts immediately.
- `CheckInStatus` (`role="status"`): polls `onCheckIn` at 5s, ×1.5 backoff capped at 30s, stops after 30 min ("Still waiting. It will appear under Nodes when it checks in."). States: "Watching for NAME to check in. You can leave this page." → "NAME registered, first run in progress…" → "NAME checked in · PLATFORM" + link "Open node" to `/orgs/${org}/nodes/${name}`. Hides Discard once state ≠ waiting. Spinner respects `motion-reduce:animate-none`.

- [ ] **Step 1: Failing component tests** (`bootstrap-flow.test.tsx`, jsdom, fake timers for polling):
  - nothing but the two cards before a pick; cards expose `aria-pressed`.
  - SSH + template `seed-web01` → pre contains `--environment _default --run-list 'role[base]'`; switch template to `seed-policy01` → `--policy-group production --policy-name web-app` and no `--environment`.
  - paste: create button calls `onCreate("web01")`; script shown contains `node_name 'web01'` and the returned key; Discard calls `onDiscard` and returns to the button.
  - `forbidden` error shows the permission alert; name `"a:b"` shows the also-the-client error and disables create.
  - taken name shows the exists message.
  - Review Focus 4: `policyGroups: []` + manual Policyfile shows the "No policy is pinned…" text.
  - Review Focus 5: `environments: null` renders a text input labelled "Environment".
  - watcher: after `onCheckIn` resolves checked-in, "Open node" link present and Discard gone.
  - `axe(container)` has no violations in the paste-created state.
- [ ] **Step 2: Run** `pnpm test bootstrap-flow` — FAIL.
- [ ] **Step 3: Implement** the page and components.
- [ ] **Step 4: Run** `pnpm test bootstrap-flow` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Add the Bootstrap a node page"`

---

### Task 7: Nodes list entry point

**Files:**
- Modify: `components/nodes-table.tsx`, `components/nodes-table.test.tsx`, `app/orgs/[org]/nodes/page.tsx`

**Interfaces:**
- Consumes: `ActionMenu` (`components/ui/action-menu.tsx`), `useRouter`.
- Produces: `NodesTable` gains prop `bootstrapHref: string`; page passes `${base}/bootstrap`.

- [ ] **Step 1: Failing tests:** header has link "Bootstrap a node" → `bootstrapHref`; the ⋯ trigger (label "More ways to add a node") opens an item "Create node only" (hint "Just the node object, no client or key. For your own automation.") that navigates to `createHref`; empty state shows the "Bootstrap a node" link as primary and keeps "Or create a node record by hand".
- [ ] **Step 2: Run** `pnpm test nodes-table` — FAIL.
- [ ] **Step 3: Implement** (replace the "New" button; empty state's main action becomes the bootstrap link, CommandSnippet there can stay below it).
- [ ] **Step 4: Run** `pnpm test nodes-table` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Make Bootstrap a node the Nodes list's primary action"`

---

### Task 8: End-to-end, docs, full check

**Files:**
- Create: `e2e/bootstrap.spec.ts`
- Modify: `e2e/nodes.spec.ts` (reach "New node" via ⋯ → "Create node only"), `e2e/a11y.spec.ts` (add `/orgs/acme/nodes/bootstrap`), `CLAUDE.md` (v1 scope line: "nodes = CRUD + bootstrap (paste script / Cinc CLI command)")

- [ ] **Step 1: Write e2e** (ADMIN unless noted):
  - Paste path: name `e2e-boot-<ts>`, "Set it up like" `seed-policy01`, create → script contains `node_name 'e2e-boot-…'` and `"policy_group": "production"` and not `chef_environment`; `/orgs/acme/clients` lists the client; Discard → client gone.
  - SSH path: create nothing — after showing the command, `/orgs/acme/clients` has no such client.
  - MEMBER on paste path → "You don't have permission to create clients in this organization."
  - Nodes list: ⋯ → "Create node only" lands on "New node".
- [ ] **Step 2: Run** `make e2e` — new specs PASS, existing PASS.
- [ ] **Step 3: Run** `make check` — PASS.
- [ ] **Step 4: Commit** `git commit -m "Cover node bootstrap end to end"`
