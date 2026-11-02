# Changelog

All notable changes to this project are documented in this file.

## 0.7.0 - 2026-11-02

### Added

- Added optional LDAP bind authentication (`AUTH_MODE=ldap`): a server-only
  search-then-bind client (`lib/ldap/client.ts`) verifies credentials against
  an external directory instead of the Cinc server's own password check. The
  authenticated username must already exist as a Cinc user object — LDAP
  never provisions one.
- Added `SESSION_SECRET_FILE` so the session secret can be read from a file
  (Docker/Compose secrets, Kubernetes secret volumes), like
  `CINC_WEBUI_KEY_FILE`. One trailing newline is stripped; `SESSION_SECRET`
  wins if both are set.
- Hid the "Change password" action on the profile page for LDAP-authenticated
  users, since their password is managed by the directory.

### Security

- Hardened signed request paths: every path handed to `cincRequest` now goes
  through `` cincPath`…` `` (`lib/cinc/path.ts`), a branded template tag that
  rejects unsanitized names — route params and form fields feed directly into
  the *signed* path, and Next decodes `%2F` back into a real `/` before a
  handler ever sees it.
- Added a login CSRF guard (`isCrossSite`, `lib/same-origin.ts`): routes that
  mint or destroy a session now reject cross-site requests and require
  `application/json`, closing the gap where SameSite=Lax stops a cross-site
  POST from *sending* our cookie but not from *obtaining* one.
- The session cookie's `Secure` flag is now decided by config
  (`SESSION_COOKIE_SECURE`) only, never inferred from `X-Forwarded-Proto` or
  `Referer`, which are attacker-supplied unless every path to the app strips
  them.
- Server Actions now allowlist the fields they write (see `pickProfileFields`
  in `app/profile/actions.ts`) instead of spreading a caller's object onto a
  webui-signed record — a Server Action's parameter type is erased at
  runtime, so a caller can submit any object.
- Added a Content-Security-Policy (nonce-based, set in `proxy.ts`) plus a
  standard set of response security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`) on every route.

### Fixed

- Fixed a Next.js production-build crash (`Cannot read properties of
  undefined (reading 'toLowerCase')`) on every LDAP login attempt, caused by
  Turbopack bundling `ldapjs`'s raw TLS/BER handling; `ldapjs` is now opted
  out of bundling via `serverExternalPackages`.
- Fixed the Docker build's `deps` stage not copying `pnpm-workspace.yaml`,
  which broke `pnpm install --frozen-lockfile` with
  `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` for any build using a private registry
  (`postcss`/`sharp` security overrides live there, not in `package.json`).

### Helm / Deployment

- Added `authMode`/`ldap.*` values and ConfigMap/Secret wiring for LDAP bind
  authentication.
- Extended the NetworkPolicy egress rules to allow LDAP/LDAPS ports (389/636,
  plus `ldap.extraNetworkPolicyPorts` for non-standard ports) when
  `authMode: ldap`.
- Added a Docker Compose example (`deploy/compose/`) for single-host
  deployments: same hardening and resource limits as the chart, secrets
  mounted as files, and an optional Caddy service for TLS.

### Merged pull requests

- Allowlist the release version where tag-release writes GITHUB_OUTPUT (#133)
- Express the LDAP bind pair check as a count in lib/config.ts (#132)
- Replace quadratic whitespace regexes in changelog.mjs (#131)
- Suppress weak-password-hash false positive in seed-user.mjs (#130)
- Run CI on Node 26 to match the container image (#129)
- Pin pnpm to 10.34.9 (#128)
- Pin actions/checkout by SHA in the release workflows (#127)
- Upgrade vitest to 5.0.5 (#126)
- Bump next to 16.4.4 and refresh deps within their ranges (#125)
- Patch vulnerable dev dependencies flagged by pnpm audit (#124)
- test: add axe accessibility checks to component tests (#121)
- Update local-testing docs for the cinc-zero -> cinc-server-ng rename (#123)
- Add Playwright e2e tests against a real cinc-server-ng (#122)
- Add tests for untested server modules and the fleet poll route (#120)
- Remove duplicated nanoid@3.3.20 entries from pnpm-lock.yaml (#118)
- Fix pnpm-lock.yaml after the vitest 4.1.11 bump (#107)
- Add a Docker Compose deployment example (#108)
- Add SESSION_SECRET_FILE to read the session secret from a file (#109)
- Patch undici and Next.js security advisories (#102)
- Point image and repository references at the cinc-project org (#90)

### Dependency updates

- chore(deps-dev): bump the development-dependencies group across 1 directory with 5 updates (#97)
- chore(deps-dev): bump jsdom from 29.1.1 to 30.1.3 (#87)
- chore(deps): bump the production-dependencies group across 1 directory with 5 updates (#113)
- chore(deps): bump the github-actions group across 1 directory with 4 updates (#117)
- chore(deps): bump zod from 4.6.5 to 4.6.6 (#119)
- chore(deps): bump undici from 8.11.2 to 8.12.2 (#115)
- chore(deps): bump next from 16.3.8 to 16.4.1 (#116)
- chore(deps-dev): bump @testing-library/jest-dom from 6.10.0 to 7.0.1 (#89)
- chore(deps-dev): bump vitest from 4.1.10 to 4.1.11 (#94)
- chore(deps): bump the production-dependencies group across 1 directory with 4 updates (#103)
- chore(deps): bump the github-actions group across 1 directory with 5 updates (#98)
- chore(deps): bump iron-session from 8.0.4 to 9.0.1 (#88)
- chore(deps): bump github/codeql-action/upload-sarif (#84)
- chore(deps): bump the production-dependencies group with 3 updates (#85)

## 0.5.0 - 2026-07-28

### Added

- Added `.env.example` with documented runtime configuration defaults and placeholders.
- Added optional `CINC_AUTH_ACTOR` support for a globally privileged signing actor.
- Added `TROUBLESHOOTING.md` guidance for `403 missing create permission` login failures.

### Changed

- Improved login/session handling to stabilize auth cookie behavior in proxied and enterprise deployments.
- Expanded build/deployment docs for private npm mirrors and cross-platform image builds.

### Helm / Deployment

- Added and documented `authActor` chart support (`CINC_AUTH_ACTOR` env wiring).
- Added a NetworkPolicy template with explicit ingress/egress port rules.

### Merged pull requests

- Handle GITHUB_TOKEN's inability to open the release PR (#77)
- Resolve the six open Dependabot security alerts (#76)
- Bump every version reference before the release artifact is built (#75)
- ci: pin GitHub Actions to commit SHAs (#74)
- stabilize login/session handling; docs: helm local overrides and build guidance (#73)
- Triage Semgrep findings as false positives (#64)
- Make new role/environment forms match the edit experience (#60)
- Add Duplicate for roles and environments (#59)

### Dependency updates

- chore(deps): bump the production-dependencies group across 1 directory with 4 updates (#70)
- chore(deps-dev): bump the development-dependencies group across 1 directory with 6 updates (#71)
- chore(deps): bump the github-actions group across 1 directory with 10 updates (#69)
- chore(deps): bump next from 16.2.9 to 16.2.11 (#72)

## 0.4.0 - 2026-06-30

### Merged pull requests

- Use matched brackets in the missing-count range query (#58)
- Bound the client-lifecycle fetch with a timeout (#57)
- Stream the org dashboard + split tile/list refresh cadence (#56)
- Extract shared client-chip, nodes-table, time and icon helpers (#55)

## 0.3.0 - 2026-06-29

### Merged pull requests

- Add latest-version and version-count columns to cookbooks list (#54)
- Use sortable column headers instead of toggle buttons (#53)
- Add sorting to the lists on every page (#52)
- Fix unconfigured tile filter showing an empty table (#51)
- Add org fleet dashboard (missing / unconfigured / outdated clients) (#50)

## 0.2.1 - 2026-06-28

### Merged pull requests

- Publish signed, multi-arch container images on each release (#49)

## 0.2.0 - 2026-06-28

### Merged pull requests

- Fix constraint row layout: size wrappers, not the inputs (#48)
- Tighten and surface version validation in the constraints editor (#47)
- Fix create-form labels rendering beside the field instead of above it (#45)
- Validate object names against Chef's rules before submit (#46)
- Visual design pass: contrast, typography, and layout polish (#44)
- Drop redundant id section from data bag item view (#43)
- Add a guided editor for environment cookbook constraints (#41)
- Harden post-login redirect against backslash open-redirect (#42)
- feat: return to the prior page after a session expires (#40)
- feat: jump to a node/role/environment/policy by name from ⌘K (#36)
- feat: edit node tags inline (#37)
- feat: structured group membership editing (no JSON) (#38)
- feat: path-derived breadcrumbs for org pages (#39)
- feat: edit the overview (description) on roles and environments (#35)
- feat: copy-to-clipboard for JSON and attribute values (#34)
- feat: ⌘K command palette for keyboard-first navigation (#33)
- refine: subtle corner Edit affordance for the run list (#32)
- feat: run-list editing is opt-in with an Edit affordance and Cancel (#31)
- a11y: WCAG 2.2 fixes — skip link, nav landmark, JSON editor label (#30)
- feat: inline run-list editing for nodes and roles (#29)
- docs: update object scope for clients/cookbooks/policies deletes (#28)
- feat: delete a policy revision or a whole policy (#27)

## 0.1.0

- Initial release of Cinc Console.
