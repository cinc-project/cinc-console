# Bootstrap a node — design

Status: draft for approval · 2026-11-26

## Why

"New" on the Nodes list opens a JSON editor for a bare node object. That is
not what anyone adding a machine wants: a node record alone does nothing. To
bring a machine under Cinc it needs Cinc Client installed, an API client with
a private key, a `client.rb` pointing at the server, and a first run. Today
the console helps with none of that, so bootstrapping means leaving the
console entirely.

Goal: from the Nodes list, bootstrapping an **existing, running machine** is
the default path, and it ends with that machine checked in, with as little
copying and typing as possible.

## Goals

- **Bootstrap a node** is the primary action on the Nodes list (header and
  empty state).
- The page asks one question first: *how will you reach the machine?*
  - **I can SSH to it** (recommended): the console gives a
    `cinc node bootstrap` command to run from the workstation. The console
    creates nothing, and no secret passes through the browser.
  - **I'm on the machine**: the console creates the API client and shows a
    script, with the new key embedded, to paste into a shell where you can sudo.
- Supports both management modes, which exclude each other:
  - **Roles + environment**: environment and run list.
  - **Policyfile**: policy group and policy name, with **no environment and
    no run list**.
- "Set it up like <existing node>" copies an existing node's mode and
  settings (environment + run list, or policy group + policy). "Choose
  manually" shows the pickers.
- After the command or script is shown, the page watches for the node's
  first check-in and links to it once it appears.
- Today's JSON editor stays, as **Create node only** in a ⋯ menu beside the
  primary button, for people doing their own automation.

## Non-goals

- The console never SSHes to or otherwise runs anything on a machine.
- No hosted single-use enrollment URL / cloud-init flow (it would need
  stored server-side state). Possible later.
- No knife commands. Cinc CLI only on this page.
- No editing of roles/policies from this page.

## Anti-goals (a failure even if it works)

- A paste script that differs from what `cinc node bootstrap` runs on a
  target. Two bootstrap paths that behave differently is a support trap.
- The key being retrievable after the page is left, or ever logged or
  persisted by the console.
- Creating the client on the SSH path. `cinc node bootstrap` creates the
  client itself, and a pre-existing client makes it fail with a 409.

## Constraints (from the codebase and cinc-cli)

- **The node is created by its first run, not by the console.** This matches
  cinc-cli (`cli/remote/bootstrap.go`, `apps/cinc/cmd/node.go`). The
  workstation creates only the **client**. The target's first
  `cinc-client -j /etc/cinc/first-boot.json` creates the node *as that
  client*, so the client owns its node and no ACL edits are needed.
  `first-boot.json` carries `run_list` + `chef_environment` (roles mode) or
  `policy_name` + `policy_group` (policy mode, with `chef_environment`
  omitted, because cinc-client aborts if both are set).
- **Paste script = a TypeScript port of cinc-cli's `BootstrapCommand`.**
  Same steps, in the same order: `set -e`; download the installer to a
  `mktemp` file with `curl -fsSL` (not piped into bash); run it;
  `mkdir -p /etc/cinc`; `install -m 0600 /dev/null /etc/cinc/client.pem`;
  write the key; `chmod 0600 /etc/cinc/client.pem`; write `client.rb`
  (`chef_server_url`, `node_name`, `client_key`); write `first-boot.json`
  (each file through a heredoc); `cinc-client -j /etc/cinc/first-boot.json`.
  **Every privileged command is prefixed with `sudo`**, as with the CLI's
  default `--sudo=true`. That works for a sudoer and harmlessly for root
  wherever `sudo` exists, so the page says "paste into a shell where you can
  sudo". Port the heredoc-delimiter and newline guards and the Ruby/shell
  quoting too. A unit test pins its output against a fixture produced by
  `cinc node bootstrap --dry-run` with default flags (the same pattern as
  the signing conformance test).
- **Server-only boundaries.** Client creation goes through a `"use server"`
  action (`lib/cinc/clients.ts#createClient` already returns the one-time
  private key). The script builder is a pure module with no `server-only`
  import, so the client component can rebuild the script live as fields
  change.
- **Security invariants (CLAUDE.md).** Every server action validates its
  arguments. The name must pass **both** `nameError("node")` and
  `nameError("client")`, since it is both, and the client rule is stricter
  (no `:`). The environment uses `nameError("environment")`. Run-list
  entries must be `role[NAME]`, `recipe[NAME]`, `recipe[COOKBOOK::RECIPE]`,
  or either recipe form with a version pin `@x.y.z` (real nodes carry
  pins, and "Set it up like" must copy them). Policy group and policy name
  use new `nameError` kinds, added to `lib/cinc/names.ts` with tests (no
  such kinds exist today). Paths go through `cincPath`. The script builder rejects anything that isn't
  name-shaped. That is defense in depth, since the values end up in a
  root shell.
- **Server URL in the script** is `CINC_SERVER_URL` + `/organizations/<org>`,
  the same way cinc-cli builds it (`FormatServerURL`).
- **ACLs stay the server's job.** A 403 on client create shows "You don't
  have permission to create clients in this organization." Picker lists
  that fail to load (403) fall back to free-text fields.
- **WCAG 2.2 AA.** The path cards are `<button aria-pressed>`. The status
  line uses `role="status"`. The ⋯ menu follows the menu-button pattern.
  The one-time-key warning uses icon + text, never color alone.
  `prefers-reduced-motion` is respected.

## Approaches considered

From the design canvas (three clickable directions):

- **A. Guided steps**: a four-step wizard. Hardest to get wrong, but the
  slowest for repeat use.
- **B. One page, live script**: a form plus a live script preview. Fastest
  for repeat use, but busier, and it treats SSH and paste as a toggle
  rather than different flows.
- **C. Pick how you reach it** — **chosen.** Leading with the reach question
  matches the real fork: the two paths create different things (nothing vs.
  a client) and hand over different artifacts (a command vs. a script with a
  key). "Set it up like" keeps repeat use fast.

## The design

### Entry point (`/orgs/[org]/nodes`)

- Header: primary **Bootstrap a node** → `/orgs/[org]/nodes/bootstrap`.
  Beside it, a ⋯ menu button ("More ways to add a node") with one item:
  **Create node only**, described as *"Just the node object, no client or
  key. For your own automation."* It goes to the existing
  `/orgs/[org]/nodes/new`.
- Empty state: the same primary link replaces the bare command snippet as
  the main call to action. "Create node only" stays as the secondary link.

### Bootstrap page (`/orgs/[org]/nodes/bootstrap`)

Server component loads, in parallel via `safeGet`: the fleet snapshot (for
"Set it up like" and the node half of the name-taken check), the clients
list (the client half: the snapshot is a node search and has no clients),
environments, roles, and policy groups with their pinned policies. Passes them to a client component.

1. **Two path cards**: "I can SSH to it" (recommended badge) and "I'm on the
   machine", each with an inline-SVG illustration.
2. **About the node** (appears once a path is picked):
   - **Name**: validated live with `nameError("node")`. An error if a node
     *or* client of that name already exists, linking to it.
   - **Host or IP** (SSH path only): fills the command's target. Optional
     when it equals the name.
   - **Set it up like**: a select grouped into "Roles + environment" and
     "Policyfile" nodes from the fleet snapshot, plus "Choose manually". A
     summary line shows what the node will get, with a mode badge.
   - **Choose manually** shows a Roles+environment / Policyfile switch.
     Roles mode: an environment select (no `_default` restriction; it's a
     valid target) plus a role multi-select. Policy mode: a policy group
     select, then a policy select limited to the policies pinned in that
     group.
3. **Output panel**:
   - **SSH**: the `cinc node bootstrap` command, built live:
     `cinc node bootstrap HOST --ssh-user USER --node-name NAME` +
     `--environment E --run-list 'a,b'` or
     `--policy-group G --policy-name P`. `USER` stays an uppercase
     placeholder. Reuse `CommandSnippet`'s placeholder highlighting but
     **not the component itself**, because it always shows a knife tab.
     Extract the placeholder renderer into a shared helper. A copy button. A
     note: *First time on this workstation? Run `cinc config create`.*
   - **Paste**: a **Create client and show script** button (nothing is
     created until it's clicked). On success it shows the full script, with
     Copy and Download `bootstrap-<name>.sh`, plus the `OneTimeKey`-style
     warning that it's shown once. A **Discard** action deletes the
     just-created client (for "I changed my mind"). Discard is available
     only until the watcher sees the node. After that the node exists and
     is owned by the client, and removing it is the node page's Delete
     (which can also delete the client). The server action enforces this
     too: it refuses if the node exists. Leaving the page keeps the client.
     The client page can regenerate a key later.
4. **Check-in watcher**: once the command or script is shown, the page
   polls the node (`GET /nodes/<name>`) through a server action every 5s,
   backing off to 30s, and stops after 30 minutes. It shows: Waiting →
   node exists → first run finished (`ohai_time` set) with a platform
   summary and an **Open node** link. The text says you can leave the page.

### New/changed modules (a sketch for the planner)

- `lib/bootstrap/script.ts`: a pure `bootstrapScript(opts)` port, plus
  `bootstrapCommand(opts)` for the CLI line. Has tests and the dry-run
  fixture.
- `lib/bootstrap/run-list.ts`: validates `role[]`/`recipe[]` entries.
- `app/orgs/[org]/nodes/bootstrap/{page.tsx,bootstrap-form.tsx,actions.ts}`:
  `createBootstrapClient(org, name)` (validates, rejects if a node exists,
  creates the client, returns the key), `discardBootstrapClient(org, name)`,
  and `nodeCheckIn(org, name)`.
- `components/nodes-table.tsx`: header button + ⋯ menu, and the empty state.
- e2e (`e2e/nodes.spec.ts`): the paste path creates a client and shows a
  script containing the server URL and node name; the SSH path creates
  nothing; a policy node's output has no `--environment`/`chef_environment`;
  a user without client-create permission sees the forbidden message. Plus
  an axe pass on the page.

## Calls I made (check these)

1. **Linux/macOS only for the paste script in v1.** cinc-cli has no Windows
   bootstrap to match, and `cinc node bootstrap` is SSH-only. Choosing
   "Windows" isn't offered yet.
2. **No separate "node-facing" server URL.** The script uses
   `CINC_SERVER_URL`. If machines reach the server by a different address
   than the console does, that's a follow-up config (`CINC_NODE_SERVER_URL`,
   which would also need adding to the Helm chart and Compose).
3. **Roles only in the manual picker.** Recipes come along when copied from
   an existing node's run list, but there's no recipe picker in v1.
4. **The client is created only on an explicit click**, not when the
   "I'm on the machine" card is picked (the mockup implied the latter).
5. **Leaving after Create keeps the client.** Only an explicit Discard
   deletes it, and only before the node first checks in.
6. **The paste script uses `sudo`**, matching the CLI's default dry run.
7. **Version-pinned run-list entries (`recipe[x@1.2.3]`) are accepted.**

## Left to the builder

Component breakdown, polling implementation, exact copy, and the visual
details within the existing design tokens (the canvas mockup
`C · Pick how you reach it` is the visual reference).

## Later: testing against a real server

`make e2e` runs against cinc-server-ng and can't execute the script on a
machine. For a real end-to-end check (paste script and
`cinc node bootstrap` run on a VM that then checks in), reuse cinc-cli's
AWS stack in `integration/terraform/` (a real Cinc Server, via
`integration/run-cinc-server-erlang.sh`), adding a second instance as the
bootstrap target. This is not part of this change.
