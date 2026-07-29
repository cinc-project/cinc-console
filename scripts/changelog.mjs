#!/usr/bin/env node
// Generate a CHANGELOG.md section for a release from the PR titles merged since
// the previous tag.
//
//   node scripts/changelog.mjs 0.5.0                    insert a 0.5.0 section
//   node scripts/changelog.mjs 0.5.0 --from v0.4.0      pin the lower bound
//   node scripts/changelog.mjs --extract 0.5.0          print a section's body
//
// This repo squash-merges, so every commit subject on main *is* a PR title with
// its "(#123)" already attached — `git log --format=%s` is the whole data
// source. No API call, no token, and the transforms below stay pure and
// testable.
//
// An existing "## Unreleased" section is absorbed rather than pushed down: its
// hand-written prose is kept and the generated list is appended beneath it, so
// curated notes survive while the generated list stays complete. The result
// lands in a release PR, so anything unwanted can be trimmed before merge.

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { SEMVER } from "./set-version.mjs";

const UNRELEASED = "## Unreleased";

/** Split a changelog into its preamble and its "## " sections, verbatim. */
export function splitSections(text) {
  const starts = [...text.matchAll(/^## .*$/gm)].map((m) => m.index);
  if (starts.length === 0) return { preamble: text, sections: [] };

  const sections = starts.map((start, i) => {
    const chunk = text.slice(start, starts[i + 1] ?? text.length);
    const nl = chunk.indexOf("\n");
    return nl === -1
      ? { heading: chunk, body: "" }
      : { heading: chunk.slice(0, nl), body: chunk.slice(nl + 1) };
  });

  return { preamble: text.slice(0, starts[0]), sections };
}

export function joinSections(preamble, sections) {
  return preamble + sections.map((s) => `${s.heading}\n${s.body}`).join("");
}

/** Exactly one blank line after the heading and before the next one. */
function normalizeBody(body) {
  return `\n${body.replace(/^\s*\n/, "").replace(/\s+$/, "")}\n\n`;
}

// Dependency bumps are split out so a release with a dozen Dependabot PRs does
// not drown the changes a reader actually cares about.
//
// These headings are deliberately not "Changed"/"Added": an absorbed Unreleased
// section usually already uses those, and "### Changed" sitting next to a
// generated "### Changes" reads as a typo.
export function renderBullets(subjects) {
  const deps = [];
  const changes = [];
  for (const s of subjects) (/^chore\(deps/.test(s) ? deps : changes).push(s);

  const lines = [];
  for (const [title, group] of [
    ["### Merged pull requests", changes],
    ["### Dependency updates", deps],
  ]) {
    if (group.length > 0) lines.push(title, "", ...group.map((s) => `- ${s}`), "");
  }
  return lines.join("\n");
}

export function addRelease(text, version, date, subjects) {
  const { preamble, sections } = splitSections(text);
  const heading = `## ${version} - ${date}`;
  const bullets = renderBullets(subjects);

  if (sections[0]?.heading.trim() === UNRELEASED) {
    const prose = sections[0].body.replace(/\s+$/, "");
    sections[0] = {
      heading,
      body: normalizeBody(prose ? `${prose}\n\n${bullets}` : bullets),
    };
  } else {
    sections.unshift({ heading, body: normalizeBody(bullets) });
  }

  return joinSections(preamble, sections);
}

/** A section's body, for use as GitHub Release notes. */
export function extractSection(text, version) {
  const { sections } = splitSections(text);
  const match = sections.find((s) => s.heading.replace(/^## /, "").split(" ")[0] === version);
  return match ? `${match.body.trim()}\n` : "";
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/** Squash-merge commit subjects in (from, to], newest first. */
export function subjectsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  return git("log", "--no-merges", "--format=%s", range).split("\n").filter(Boolean);
}

const usage = `usage: changelog.mjs <version> [--from <ref>] [--to <ref>] [--date YYYY-MM-DD]
       changelog.mjs --extract <version>`;

function flag(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

async function main(argv) {
  const extract = argv.includes("--extract");
  const version = argv.find((a) => !a.startsWith("--") && SEMVER.test(a));

  if (!version) {
    console.error(usage);
    return 2;
  }

  const path = new URL("../CHANGELOG.md", import.meta.url);
  const before = await readFile(path, "utf8");

  if (extract) {
    const body = extractSection(before, version);
    if (!body.trim()) {
      console.error(`changelog: no section for ${version}`);
      return 1;
    }
    process.stdout.write(body);
    return 0;
  }

  const to = flag(argv, "--to") ?? "HEAD";
  // `git describe` finds the most recent tag reachable from `to`; on the very
  // first release there is none, so fall back to the whole history.
  let from = flag(argv, "--from");
  if (from === undefined) {
    try {
      from = git("describe", "--tags", "--abbrev=0", to);
    } catch {
      from = "";
    }
  }

  const subjects = subjectsBetween(from, to);
  if (subjects.length === 0) {
    console.error(`changelog: no commits in ${from || "<root>"}..${to}`);
    return 1;
  }

  const date = flag(argv, "--date") ?? new Date().toISOString().slice(0, 10);
  await writeFile(path, addRelease(before, version, date, subjects));
  console.log(`CHANGELOG.md += ${version} - ${date} (${subjects.length} commits)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
