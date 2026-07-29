# Changelog

All notable changes to this project are documented in this file.

## 0.5.0 - 2026-07-29

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
