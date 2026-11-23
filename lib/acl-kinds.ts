/**
 * What has an ACL, and the five permissions in each. Client-safe, so routes,
 * forms and actions validate against the same lists.
 */
export const PERMS = ["create", "read", "update", "delete", "grant"] as const;
export type Perm = (typeof PERMS)[number];

/** Object kinds whose ACL lives at /<kind>/<name>/_acl (users: /users/<name>/_acl). */
export const ACL_KINDS = [
  "containers",
  "nodes",
  "roles",
  "environments",
  "data",
  "clients",
  "groups",
  "cookbooks",
  "policies",
  "policy_groups",
  "users",
] as const;
export type AclKind = (typeof ACL_KINDS)[number];

export function isAclKind(v: unknown): v is AclKind {
  return typeof v === "string" && (ACL_KINDS as readonly string[]).includes(v);
}

export function isPerm(v: unknown): v is Perm {
  return typeof v === "string" && (PERMS as readonly string[]).includes(v);
}

/** The org itself, or one named object. */
export type AclTarget = { kind: "organization" } | { kind: AclKind; name: string };

export const KIND_LABELS: Record<AclKind, string> = {
  containers: "Container",
  nodes: "Node",
  roles: "Role",
  environments: "Environment",
  data: "Data bag",
  clients: "Client",
  groups: "Group",
  cookbooks: "Cookbook",
  policies: "Policy",
  policy_groups: "Policy group",
  users: "User",
};

/** What each permission allows. On a container, create means "make new ones". */
export const PERM_HELP: Record<Perm, string> = {
  create: "Create new objects (on a container or the organization)",
  read: "View it",
  update: "Change it",
  delete: "Delete it",
  grant: "Change these permissions",
};

/** The console page for a target's permissions. */
export function permissionsHref(org: string, target: AclTarget): string {
  const base = `/orgs/${org}/permissions`;
  return target.kind === "organization"
    ? `${base}/organization`
    : `${base}/${target.kind}/${encodeURIComponent(target.name)}`;
}

/**
 * Why a target's Permissions button is disabled. Reading an ACL needs grant on
 * the target, so a viewer without it would only reach a 403.
 */
export function permissionsDeniedText(target: AclTarget): string {
  const noun = target.kind === "organization" ? "organization" : KIND_LABELS[target.kind].toLowerCase();
  return `You need grant permission on this ${noun} to view or change its permissions.`;
}
