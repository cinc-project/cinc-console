/**
 * Client-side name validation mirroring Chef Server's own rules, so users get
 * immediate feedback instead of a generic 400 from the server. The patterns are
 * transcribed from chef/chef's validation constants (`[:alnum:]` is ASCII
 * letters + digits):
 *
 *   data bag / item id  /^[\.\-[:alnum:]_]+$/   (alnum _ - .)
 *   environment / role  /^[\-[:alnum:]_]+$/     (alnum _ - ; no dot)
 *   node                /^[\-[:alnum:]_:.]+$/   (alnum _ - . :)
 *
 *   key                 /^[\.:\-[:alnum:]_]+$/  (alnum _ - . :)
 *   group               /^[a-z0-9_-]+$/          (lowercase, digits, _ -)
 *
 * Clients are validated by the Erchef server rather than chef-client; we apply
 * the data-bag character set as a close, conservative approximation.
 */
export type NameKind =
  | "data_bag"
  | "data_bag_item"
  | "environment"
  | "role"
  | "node"
  | "client"
  | "key"
  | "group";

const PATTERNS: Record<NameKind, RegExp> = {
  data_bag: /^[.\-A-Za-z0-9_]+$/,
  data_bag_item: /^[.\-A-Za-z0-9_]+$/,
  environment: /^[\-A-Za-z0-9_]+$/,
  role: /^[\-A-Za-z0-9_]+$/,
  node: /^[.:\-A-Za-z0-9_]+$/,
  client: /^[.\-A-Za-z0-9_]+$/,
  key: /^[.:\-A-Za-z0-9_]+$/,
  group: /^[a-z0-9_-]+$/,
};

const HINTS: Record<NameKind, string> = {
  data_bag: "letters, numbers, and . _ -",
  data_bag_item: "letters, numbers, and . _ -",
  environment: "letters, numbers, and _ - (no dots)",
  role: "letters, numbers, and _ - (no dots)",
  node: "letters, numbers, and . : _ -",
  client: "letters, numbers, and . _ -",
  key: "letters, numbers, and . : _ -",
  group: "lowercase letters, numbers, _ and -",
};

// Data bags may not be named after other Chef object types.
const RESERVED_DATA_BAG = new Set(["node", "role", "environment", "client"]);

/**
 * Returns a human-readable error if `raw` is not a valid name for `kind`, or
 * null if it is valid (or empty — emptiness is handled by the form's required
 * state, so we don't nag while the field is still blank).
 */
export function nameError(kind: NameKind, raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (!PATTERNS[kind].test(name)) {
    return `Use only ${HINTS[kind]}.`;
  }
  if (kind === "data_bag" && RESERVED_DATA_BAG.has(name)) {
    return `"${name}" is a reserved name and can't be used for a data bag.`;
  }
  if (kind === "environment" && name === "_default") {
    return `"_default" is a reserved environment name.`;
  }
  return null;
}
