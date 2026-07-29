# Releasing cinc-console

Cutting a release is two steps: open a release PR, then merge it. Everything
else — tagging, release notes, the signed multi-arch image — follows from the
merge.

## One-time setup

`GITHUB_TOKEN` cannot open a pull request unless a repo setting allows it, and
even when allowed, **a PR it opens gets no CI run** — GitHub does not start
workflows for events triggered by `GITHUB_TOKEN`. Since the point of the release
PR is to review the diff with a green build on the exact tree that ships, pick
one:

| Option | PR opens automatically | CI runs on it |
| --- | --- | --- |
| `RELEASE_PR_TOKEN` secret (**recommended**) | yes | yes |
| Settings → Actions → General → *Allow GitHub Actions to create and approve pull requests* | yes | **no** |
| Neither | no — you get a one-click link | yes (you opened it) |

For the first, add a repository secret named `RELEASE_PR_TOKEN` holding a PAT or
GitHub App token with `contents: write` and `pull-requests: write`.

With none of these, `release-pr` still does all the real work — it pushes
`release/<version>` with the bump and CHANGELOG — and the run summary gives you a
link that opens the PR prefilled. The release is not blocked, just one click
longer.

## Cut a release

```bash
make release-pr VERSION=0.5.0        # or: gh workflow run release-pr.yml -f version=0.5.0
```

That opens a **Release 0.5.0** PR on branch `release/0.5.0` containing:

- `package.json` → `version: 0.5.0`
- `deploy/helm/cinc-console/Chart.yaml` → `version` and `appVersion` → `0.5.0`
- `CHANGELOG.md` → a `## 0.5.0 - <date>` section

Review it like any other PR. CI runs against it, so you get the full `make check`
signal on the exact tree that will be released. Reword the generated notes on the
branch if you want — they become the GitHub Release body verbatim.

**Merging the PR** tags `v0.5.0` at the merge commit, publishes the GitHub
Release, and builds `ghcr.io/<owner>/cinc-console` tagged `0.5.0`, `0.5`, and
`latest`.

To change the version after opening the PR, re-run the workflow with the new
version. Each version gets its own branch; close the one you don't want.

## Why the bump happens before the build

The image build checks out **the tag**. Because the version bump is part of the
commit that gets tagged, the build cannot see a stale version — the ordering is
structural rather than a step someone has to remember.

Two independent guards back that up, both running `set-version.mjs --check`:

| Guard | When | Refuses to |
| --- | --- | --- |
| `tag-release.yml` | after merge, before tagging | tag a tree whose version files disagree with `release/<version>` |
| `release.yml` | after checkout, before buildx | build an image whose tree disagrees with the tag |

Run the same check locally: `make version-check VERSION=0.5.0`.

## The version lives in three places

`scripts/set-version.mjs` is the only thing that knows where. Adding a fourth
place means adding a target there — and a test in `scripts/set-version.test.ts` —
so `--check` covers it everywhere at once.

`deploy/helm/cinc-console/values.yaml` deliberately has `image.tag: ""`, which
defers to `.Chart.AppVersion`. Leave it that way: it means one Helm version to
bump, not two that can drift.

## Changelog entries

`scripts/changelog.mjs` generates the release section from the PR titles merged
since the previous tag. The repo squash-merges, so every commit subject on `main`
is a PR title with its `(#123)` already attached — `git log --format=%s` is the
whole data source. Dependency bumps (`chore(deps…)`) are grouped separately so
they don't drown the changes readers care about.

An optional `## Unreleased` section at the top is **absorbed** into the release
rather than pushed down: its hand-written prose is kept and the generated list is
appended beneath it. Use it when a change needs more explanation than its PR
title carries.

## Prereleases

A version with a suffix (`0.5.0-rc.1`) works the same way, except the GitHub
Release is marked as a prerelease and the floating `0.5` and `latest` image tags
are **not** moved to it.

## Publishing a release by hand

`release.yml` still triggers on `release: published`, so creating a Release in
the GitHub UI builds the image as before — with the version check now applied.
Bump the version files first, or it will refuse to build.

Note that a Release created by `tag-release.yml` does *not* fire that trigger:
actions taken with the default `GITHUB_TOKEN` don't trigger further workflows,
which is why `tag-release.yml` calls `release.yml` directly. The upside is that
neither path can double-build.
