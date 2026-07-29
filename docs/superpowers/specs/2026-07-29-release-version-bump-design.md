# Release version bump — design

**Date:** 2026-07-29
**Status:** implemented

## Problem

Releases were cut by hand-creating a GitHub Release, which fired `release.yml` to
build the image. Nothing bumped the version *in* the repo, so by v0.4.0:

| Place | Value | Reality |
| --- | --- | --- |
| `package.json` | `0.1.1` | 3 releases stale |
| `Chart.yaml` `version` / `appVersion` | `0.1.1` | 3 releases stale |
| `CHANGELOG.md` top entry | `0.1.1` | no entries for 0.2.0–0.4.0 |
| `BUILD.md` examples | `0.1.1` | stale, and churn to maintain |
| git tags | `v0.4.0` | the only source of truth |

The user-visible consequence: `helm install` from `main` deployed image tag
`0.1.1` — a tag that exists in GHCR, so it failed *wrongly* rather than loudly.

The ordering requirement — versions updated before the artifact is built — is
structural, not procedural. `release.yml` runs `actions/checkout` against the
**tag**, so a bump applied after tagging can never appear in the artifact.

## Approach

A release-PR flow with a human-picked version. Merging the PR is the release.

```
make release-pr VERSION=0.5.0
  └─> release-pr.yml            branch release/0.5.0
        set-version.mjs 0.5.0   package.json, Chart.yaml (version + appVersion)
        changelog.mjs 0.5.0     CHANGELOG section from merged PR titles
        opens PR "Release 0.5.0"          <- CI runs here; notes are editable
  └─> merge
  └─> tag-release.yml           on: pull_request closed, head.ref release/*
        set-version.mjs --check 0.5.0     <- gate 1: refuse to tag a bad tree
        tag v0.5.0 at the merge commit
        publish Release, body = changelog.mjs --extract 0.5.0
  └─> release.yml               via workflow_call
        checkout refs/tags/v0.5.0
        set-version.mjs --check 0.5.0     <- gate 2: refuse to build a bad tree
        buildx -> :0.5.0, :0.5, :latest
```

The bump is part of the tagged commit, so the guarantee holds by construction.
The two `--check` gates are defence in depth.

### Rejected alternatives

- **release-please** — requires committing to Conventional Commits and adds a
  config surface for a repo that releases a handful of times a quarter.
- **Bump-and-tag in one dispatch** — no review step; the bump lands on `main`
  unreviewed and CI cannot gate it before the tag exists.
- **Verify-only gate** — refuses mismatched builds but still leaves the bumping
  manual, so the drift above keeps happening.

## Components

### `scripts/set-version.mjs`

The only thing that knows where the version lives. A `TARGETS` array of
`{ file, read, set, verify }`, plus `--check` for verification. Zero dependencies.

Targets are **pure text transforms**, not parse/serialize round-trips: a
`JSON.stringify` of `package.json` or a YAML dump of `Chart.yaml` reflows the
whole file and buries a one-line change in reformatting noise. A test pins that
bumping `package.json` changes exactly one line.

`inspect()` returns `{ found, ok }` where `ok` requires `found.length > 0`. This
matters: a guard that cannot distinguish "verified N things" from "verified
nothing" is not a guard. The first implementation had `/^(?:app)?version:/`,
which never matched `appVersion` (capital V), so it read one field instead of
two and `every()` over a one-element array returned `true` — a half-bumped
`Chart.yaml` would have passed. Both the regex and the vacuous-pass hazard are
now pinned by tests.

`values.yaml` is deliberately **not** a target: `image.tag: ""` defers to
`.Chart.AppVersion`, so there is one Helm version to bump, not two that can drift.

### `scripts/changelog.mjs`

Generates a release section from the PR titles merged since the previous tag.

The repo squash-merges, so every commit subject on `main` *is* a PR title with
its `(#123)` attached — `git log --format=%s` is the entire data source. No API
call, no token, and the transforms (`splitSections`, `renderBullets`,
`addRelease`, `extractSection`) stay pure and unit-testable. `--extract` feeds
the GitHub Release body from the same text.

Dependency bumps (`chore(deps…)`) are grouped separately so a release with a
dozen Dependabot PRs does not drown the rest. Headings are `### Merged pull
requests` / `### Dependency updates` rather than `Changed`/`Added`, because an
absorbed `## Unreleased` section usually already uses those and `### Changed`
beside `### Changes` reads as a typo.

An `## Unreleased` section is **absorbed** rather than pushed down: its
hand-written prose is kept and the generated list appended beneath it. That is
the curation escape hatch for changes needing more explanation than a PR title.

### Workflows

`release.yml` gained a `workflow_call` trigger alongside `release: published`,
and resolves one bare-semver version from whichever fired. Its image tags moved
from `type=semver` to `type=raw`, because `type=semver` reads the git ref, which
under `workflow_call` is the caller's branch rather than the tag. Floating `0.5`
and `latest` are suppressed for prereleases via `enable=`.

**Why the build is called, not triggered.** Actions taken with the default
`GITHUB_TOKEN` do not trigger further workflows, so the Release that
`tag-release.yml` publishes would never have fired `release: published` — tagging
0.5.0 would produce no image, silently. Invoking `release.yml` through
`workflow_call` avoids that without a PAT, and as a side effect neither path can
double-build.

**Injection hardening.** Every untrusted value (`inputs.version`,
`pull_request.head.ref`, `release.tag_name`) reaches the shell through `env:`,
never string interpolation. The semver regex is duplicated in shell inside
`release.yml` because it must run *before* checkout — the version feeds
`checkout`'s `ref:`, and an unvalidated ref is a checkout-injection vector.
`tag-release.yml` additionally requires `head.repo.full_name == github.repository`,
so a fork PR named `release/9.9.9` cannot enter the flow.

## Drift cleanup (one time)

- `package.json` and `Chart.yaml` set to `0.4.0`, the actual latest release.
- `CHANGELOG.md` backfilled for 0.2.0, 0.2.1, 0.3.0 and 0.4.0 by running
  `changelog.mjs` over each tag range — dogfooding the generator.
- The `## 0.1.1 - 2026-07-28` entry was **mislabeled**: its content maps to PRs
  #59–#73, i.e. commits *after* v0.4.0. Relabeled `## Unreleased`. Its
  "Updated default image tag in Helm values to 0.1.1" bullet was dropped as
  inaccurate — `values.yaml` uses `tag: ""`.
- `BUILD.md` examples de-pinned to `$VERSION` so they cannot go stale.

## Incidental fix

A git worktree at `.claude/worktrees/pin-actions-to-shas` is a second copy of the
repo, and both vitest and eslint were collecting it: 35 failing tests and 18,799
lint problems, none from this repo's own code. Excluded in `vitest.config.ts` and
`eslint.config.mjs`, and gitignored. Unrelated to releases, but it blocked any
clean `make check` signal.

## Testing

`scripts/set-version.test.ts` and `scripts/changelog.test.ts` (24 tests, node
environment) cover the pure transforms — including idempotency, the
vacuous-pass guard, and blank-line normalization. Verified beyond unit tests:

- every workflow `run:` block bash-syntax-checked with `${{ }}` neutralized
- the version-resolution shell exercised for stable, prerelease, `v`-prefixed,
  partial, empty and injection inputs (`v0.5.0; touch /tmp/pwned` → rejected)
- the PR-body heredoc rendered from the real workflow with `git`/`gh` stubbed
- a full 0.5.0 dry run in an isolated copy, plus a tamper test confirming a
  hand-edited `appVersion` fails `--check`
- `make check` green; `helm template` renders `:0.4.0` instead of `:0.1.1`

## Follow-ups not taken

- No automatic backport or release-branch support; releases come off `main`.
- `RELEASING.md` documents the flow; no attempt to enforce that an
  `## Unreleased` section exists.
