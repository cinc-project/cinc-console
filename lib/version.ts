import "server-only";
import pkg from "@/package.json";

/**
 * The console's own version, read from package.json — the file
 * `scripts/set-version.mjs` writes, so it can't drift from a release.
 * Server-only so a client component can't pull the whole package.json into
 * its bundle; pass the string down as a prop instead.
 */
export const APP_VERSION: string = pkg.version;
