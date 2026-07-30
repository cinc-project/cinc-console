import "server-only";

/**
 * Guard for the request paths we sign.
 *
 * Every user-controlled name in this app — the org slug, a node/role/environment
 * name, a data bag and item id, a group, a cookbook version, a policy revision —
 * is interpolated into a path that `cincRequest` then SIGNS with the webui key.
 * Chef's v1.3 canonical string covers the path only, and the server canonicalizes
 * the path it *received and decoded*. A name carrying a separator or an escape
 * therefore lets a logged-in user aim a console-signed request at an endpoint the
 * console deliberately never exposes — `/nodes/<name>/_acl`, a sibling object
 * family, a top-level `/users/...` — instead of the one the UI implies.
 *
 * Next.js makes that trivially reachable from the address bar: it percent-decodes
 * dynamic route params, so `/orgs/acme/nodes/web01%2F_acl` arrives as the name
 * `web01/_acl`, and `%2E%2E%2F` arrives as `../`.
 *
 * So we reject the characters that can change a path's *shape* and let everything
 * else through. This is deliberately a denylist, not an allowlist of Chef's name
 * rules: names that reach a real server today keep working (odd-but-harmless
 * bytes like a space are percent-encoded on the wire and decoded back to the same
 * string the server canonicalizes), while the structural characters — which today
 * either escape the intended endpoint or 401 on a signature mismatch — are gone.
 * `lib/cinc/names.ts` still does the friendlier, stricter check in the forms; this
 * is the choke point that cannot be bypassed.
 */

/** Thrown when a name would change the shape of a signed request path. */
export class UnsafePathError extends Error {
  constructor(public readonly detail: string) {
    super(`unsafe request path: ${detail}`);
    this.name = "UnsafePathError";
  }
}

export function isUnsafePathError(e: unknown): e is UnsafePathError {
  return e instanceof UnsafePathError;
}

/**
 * `/` and `\` are segment separators (WHATWG URL treats a backslash as `/` for
 * http(s)), `?` and `#` truncate the path, and `%` re-enters percent-decoding —
 * the server decodes before it canonicalizes, so a `%2F` we sign literally
 * arrives as a real separator.
 */
const STRUCTURAL = /[/\\?#%]/;

/** Control characters, incl. CR/LF — never legal in a name, and header poison. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Throws unless `value` is safe to interpolate as one path segment. */
export function assertSafeSegment(value: string, label: string): void {
  if (value === "") {
    throw new UnsafePathError(`${label} is empty`);
  }
  if (value === "." || value === "..") {
    throw new UnsafePathError(`${label} is a relative path segment`);
  }
  if (STRUCTURAL.test(value)) {
    throw new UnsafePathError(`${label} contains a path separator or escape`);
  }
  if (CONTROL.test(value)) {
    throw new UnsafePathError(`${label} contains a control character`);
  }
}

/**
 * Throws unless `path` is an absolute path whose every segment is safe. Applied
 * to the fully assembled path (`/organizations/<org><path>`), so one call covers
 * the org slug and every name any caller spliced in.
 */
export function assertSafePath(path: string): void {
  if (!path.startsWith("/")) {
    throw new UnsafePathError("path is not absolute");
  }
  for (const segment of path.slice(1).split("/")) {
    assertSafeSegment(segment, "path segment");
  }
}

/**
 * A request path whose interpolated names have each been vetted as ONE segment.
 *
 * Checking only the assembled path is not enough: `/nodes/web01/_acl` is a
 * perfectly well-formed path, so a name of `web01/_acl` is invisible once it has
 * been concatenated — it is indistinguishable from the ACL endpoint that acl.ts
 * legitimately builds. The check has to happen where the name is still a name.
 *
 * Hence the brand: `CincRequestOptions.path` accepts only this type, so a bare
 * template string no longer compiles and the next resource module physically
 * cannot interpolate an unchecked name into something we sign.
 */
export type CincPath = string & { readonly __vetted: unique symbol };

/**
 * Tagged template for a request path: `cincPath`/nodes/${name}`` validates every
 * interpolated value as a single path segment, then the assembled path as a whole.
 */
export function cincPath(
  literals: TemplateStringsArray,
  ...values: (string | number)[]
): CincPath {
  let out = literals[0];
  values.forEach((value, i) => {
    const segment = String(value);
    assertSafeSegment(segment, "name");
    out += segment + literals[i + 1];
  });
  assertSafePath(out);
  return out as CincPath;
}
