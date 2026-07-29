#!/usr/bin/env node
// The single place that knows which files carry the release version.
//
//   node scripts/set-version.mjs 0.5.0          rewrite every target
//   node scripts/set-version.mjs --check 0.5.0  verify only; exit 1 on mismatch
//
// --check is what guards the release build: an image must never be built from a
// tree whose version files disagree with the tag being built.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Targets are pure text transforms, not parse/serialize round-trips: a
// JSON.stringify of package.json or a YAML dump of Chart.yaml would reflow the
// whole file and bury the one-line version change in reformatting noise.
export const TARGETS = [
  {
    file: "package.json",
    // The two-space indent anchors this to the top-level key; nested dependency
    // versions are indented deeper and are left alone.
    read: (text) => [...text.matchAll(/^ {2}"version": "([^"]*)"/gm)].map((m) => m[1]),
    set: (text, version) => text.replace(/^( {2}"version": ")[^"]*"/m, `$1${version}"`),
    // Cheap proof the targeted edit did not corrupt the document.
    verify: (text, version) => JSON.parse(text).version === version,
  },
  {
    file: "deploy/helm/cinc-console/Chart.yaml",
    // Both `version:` and `appVersion:` move in lockstep — the chart only ever
    // deploys this app, so a separate chart version would be bookkeeping with
    // no consumer. values.yaml needs no edit: `tag: ""` defers to appVersion.
    read: (text) => [...text.matchAll(/^(?:version|appVersion): "?([^"\n]*)"?$/gm)].map((m) => m[1]),
    set: (text, version) =>
      text
        .replace(/^version: .*$/m, `version: ${version}`)
        .replace(/^appVersion: .*$/m, `appVersion: "${version}"`),
  },
];

/** Versions a target currently declares, plus whether they all match `version`. */
export function inspect(target, text, version) {
  const found = target.read(text);
  return { found, ok: found.length > 0 && found.every((v) => v === version) };
}

const usage = `usage: set-version.mjs [--check] <version>
       version is bare semver, no leading "v" (e.g. 0.5.0)`;

async function main(argv) {
  const check = argv.includes("--check");
  const version = argv.find((a) => !a.startsWith("--"));

  if (!version) {
    console.error(usage);
    return 2;
  }
  if (!SEMVER.test(version)) {
    console.error(`set-version: "${version}" is not bare semver\n${usage}`);
    return 2;
  }

  const root = fileURLToPath(new URL("..", import.meta.url));
  const mismatches = [];

  for (const target of TARGETS) {
    const path = new URL(target.file, `file://${root}`);
    const before = await readFile(path, "utf8");

    if (check) {
      const { found, ok } = inspect(target, before, version);
      if (!ok) mismatches.push(`${target.file}: found ${found.join(", ") || "nothing"}`);
      continue;
    }

    const after = target.set(before, version);
    if (target.verify && !target.verify(after, version)) {
      console.error(`set-version: rewriting ${target.file} produced an invalid document`);
      return 1;
    }
    const { ok } = inspect(target, after, version);
    if (!ok) {
      console.error(`set-version: could not set the version in ${target.file}`);
      return 1;
    }
    if (after !== before) await writeFile(path, after);
    console.log(`${target.file} -> ${version}`);
  }

  if (mismatches.length > 0) {
    console.error(`set-version: version files disagree with ${version}`);
    for (const line of mismatches) console.error(`  ${line}`);
    return 1;
  }
  if (check) console.log(`version files agree on ${version}`);
  return 0;
}

// Only run as a CLI, so tests can import TARGETS/inspect without side effects.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
