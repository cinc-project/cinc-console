# CLAUDE.md

Guidance for Claude Code when working in cinc-console.

cinc-console is a Next.js web console for a **Cinc** Infra Server. Users log in
with a server username/password; the app signs every server request with the
**webui key** while impersonating the user (`X-Ops-Request-Source: web`), so the
**server enforces each user's ACLs** — the console never decides permissions.

> In user-facing copy say **Cinc**, never "Chef Server". Keep Chef API schema
> tokens (`chef_environment`, `Chef::Role`, `json_class`) as-is — those are the
> wire format.

## Commands

- `make help` — list targets. `pnpm` is the package manager.
- `make dev` / `pnpm dev` — dev server at http://localhost:3000.
- `make test` / `pnpm test` — Vitest (run once). `pnpm test <name>` filters.
- `make build` / `pnpm build` — production build (also the type check).
- `make lint` — eslint. `make check` — test + lint + build (CI parity).
- `make smoke` — build the image and verify `/api/healthz` (needs Docker).
- `make helm-lint` / `make helm-template` — validate the chart.
- `make release-pr VERSION=0.5.0` — open the release PR. See `RELEASING.md`.

Run `make check` before committing.

## Releasing

Never hand-edit a version. `scripts/set-version.mjs` is the only thing that knows
where the version lives (`package.json`, `Chart.yaml` `version` + `appVersion`);
adding a fourth place means adding a target there plus a test. `values.yaml` keeps
`image.tag: ""` on purpose so it defers to `.Chart.AppVersion`.

`make release-pr VERSION=x.y.z` opens a PR with the bump and a generated
CHANGELOG section; merging it tags, publishes the Release, and builds the image
from the tagged commit. Two `set-version.mjs --check` guards refuse to tag or
build a tree whose versions disagree with the tag. Full flow in `RELEASING.md`.

## This is Next.js 16 — not the one in your training data

Read `node_modules/next/dist/docs/` before using an unfamiliar API. Key changes
this project relies on:

- **`proxy.ts`, not `middleware.ts`.** The root `proxy.ts` exports `proxy()` and
  gates unauthenticated users to `/login`.
- **Async request APIs.** `cookies()`, `headers()`, and route/page `params` are
  Promises — always `await` them (`const { org } = await params`).
- Turbopack is the default bundler; `output: "standalone"` for the container.

## Architecture

Single app, three layers; the webui key and signing are **server-only**.

```
app/                 UI (RSC + client components) + route handlers + server actions
  api/healthz        liveness/readiness (Dockerfile + Helm probes depend on it)
  api/auth/*         login (authenticate_user) / logout
  login/             username+password form
  orgs/[org]/<kind>/ list / [name] detail / new — one dir per object type
lib/cinc/            server-only Cinc client (NEVER import into a client component)
  signing.ts         v1.3 SHA-256 signing — faithful port of cinc-api; conformance-tested
  client.ts          signed transport; webui impersonation headers; TLS/CA; CincError
  resource.ts        makeResource(kind) -> list/get/create/update/remove
  action.ts          runAction() maps CincError -> { ok } | { error } (403 -> "forbidden")
  safe-get.ts        safeGet() for reads; explainRead() for messages
  auth.ts orgs.ts databags.ts members.ts readonly.ts acl.ts
lib/config.ts        fail-fast zod env validation (getConfig)
lib/session.ts       stateless encrypted iron-session cookie (username only)
lib/guard.ts         currentUser() — redirects to /login in a Server Component
components/          AppShell, ResourceTable, ObjectEditor, JsonEditor, NewObjectForm, ui/*
deploy/helm/         chart; Dockerfile + scripts/smoke.sh at root
```

Request path: client → route handler / server action → `lib/cinc` (sign with
webui key, set `X-Ops-UserId: <session user>` + `X-Ops-Request-Source: web`) →
Cinc server → ACL decision. The UI reacts to 200/403/404; a 403 means "no
permission" (it never substitutes its own check).

## Conventions

- **`lib/cinc/*` and `lib/session.ts` import `"server-only"`.** Never import them
  into a client component; go through a route handler or server action.
- **Object types follow the `nodes` reference** (`app/orgs/[org]/nodes/`): a
  per-kind `actions.ts` (`"use server"`) delegating to `makeResource` +
  `runAction`/`parseJsonObject`, list/detail/new pages, server actions bound with
  `.bind(null, org, name)` and passed to `ObjectEditor`/`NewObjectForm`.
- **Mutations return `{ ok: true } | { error: string }`** via `runAction`.
- v1 scope: nodes/roles/environments/data bags/members & groups = CRUD;
  clients = create + delete (no edit); cookbooks/policies = view + delete
  (a version/revision or the whole object). Editing cookbook/policy content
  and cookbook uploads are out of scope. `_default` environment is read-only.

## Dependency overrides

`package.json` `pnpm.overrides` forces patched versions of transitive packages
whose parent pins a vulnerable range — currently `postcss` and `sharp`, both
pinned by `next` (`postcss 8.4.31` exactly, `sharp ^0.34.5`), so no `next`
upgrade fixes them. Each override is scoped to the vulnerable range
(`"postcss@<8.5.18": ">=8.5.18"`), so it stops applying once upstream catches
up. Drop an entry when `next` bumps its own pin past the advisory; check with
`pnpm why <pkg>` and `pnpm audit`.

## Accessibility

**We comply with [WCAG 2.2 level AA](https://www.w3.org/TR/WCAG22/) — treat it
as a hard requirement in everything we build, not a later polish pass.** A
feature is not done until it works with a keyboard and a screen reader. Concretely:

- Prefer semantic HTML and native controls (`<button>`, `<a>`, `<label htmlFor>`,
  `<dialog>`) before reaching for ARIA. Every interactive element must be
  keyboard-operable and have an accessible name.
- Never signal state by **color alone** — pair it with text or an icon (e.g.
  errors get an icon + `role="alert"`, not just red text).
- Keep focus **visible** and managed: trap focus in modals, restore it on close,
  and provide a skip-to-content link.
- Announce async status/errors via `role="alert"` or an `aria-live` region.
- Meet AA **contrast** (4.5:1 text, 3:1 UI/large text) and respect
  `prefers-reduced-motion`.
- New or changed UI should be checked against these before `make check` passes.

## Testing

- Vitest. Server-side tests (signing, client, actions, lib) need the **node
  environment** — add `// @vitest-environment node` at the top of the file.
- The signing **conformance test** pins byte-for-byte parity with `cinc-api`
  using `lib/cinc/__fixtures__/test_key.pem` (copied from `cinc-api/testdata`).
  Don't weaken it.
- Mock modules a `"use server"` file imports at load time with **`vi.hoisted`**
  (a bare `const` in a `vi.mock` factory hits a TDZ error).
- `server-only` is aliased to a stub in `vitest.config.ts` so server modules
  import under test.

## Configuration

Required env (validated at boot, fail-fast): `CINC_SERVER_URL`,
`CINC_WEBUI_KEY` (PEM), `SESSION_SECRET` (32+ chars). Optional: `CINC_CA_CERT`,
`CINC_SSL_NO_VERIFY`, `SESSION_TTL_SECONDS`. See `.env.example`.

## Local testing against cinc-zero

`cinc-zero` (../cinc-zero) speaks the Cinc API and supports webui impersonation
as of **v0.7.0** — earlier versions verify each request against the
`X-Ops-UserId` user's own key and return 401 for the console's signed-as-webui
requests. **v0.8.0+** seeds a ready login (`anna` / `anna123`) in `dev/test-repo`.

```bash
cinc-zero --state dev/test-repo --key-out /tmp/webui.pem   # admin key doubles as the webui key
```

Point the console at it: `CINC_SERVER_URL=http://127.0.0.1:8890`,
`CINC_WEBUI_KEY=$(cat /tmp/webui.pem)`, then log in as **anna / anna123**.

Login requires a user **with a password** (cinc-zero stores passwords out-of-band
for `authenticate_user`). To mint another, run `node scripts/seed-user.mjs
<name> <password>` with the same `CINC_SERVER_URL`/`CINC_WEBUI_KEY` env, or
`POST /users {"name":"…","password":"…"}` signed via the webui key.

Design spec and implementation plan live in `docs/superpowers/`.
