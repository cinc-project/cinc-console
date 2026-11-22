import "server-only";
import { cincRequest } from "./client";
import { cincPath, type CincPath } from "./path";
import { PERMS, type AclTarget, type Perm } from "@/lib/acl-kinds";

/**
 * Access control lists. Each object, container (the permission to make new
 * objects of a kind lives on its container), the org itself and each user has
 * one, granting create/read/update/delete/grant to actors (users and clients,
 * one list) and groups. Reading or changing an ACL needs `grant` on it.
 */
export type AclEntry = { actors: string[]; groups: string[] };
export type Acl = Record<Perm, AclEntry>;

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function where(target: AclTarget, perm?: Perm): { global: boolean; path: CincPath } {
  if (target.kind === "organization") {
    return {
      global: false,
      path: perm ? cincPath`/organizations/_acl/${perm}` : cincPath`/organizations/_acl`,
    };
  }
  const { kind, name } = target;
  return {
    // A user's ACL is global, like the user.
    global: kind === "users",
    path: perm ? cincPath`/${kind}/${name}/_acl/${perm}` : cincPath`/${kind}/${name}/_acl`,
  };
}

/** Normalize a server ACL: every permission present, lists of strings. */
export function normalizeAcl(raw: unknown): Acl {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const acl = {} as Acl;
  for (const perm of PERMS) {
    const e = src[perm] && typeof src[perm] === "object" ? (src[perm] as Record<string, unknown>) : {};
    acl[perm] = { actors: strings(e.actors), groups: strings(e.groups) };
  }
  return acl;
}

export async function getAcl(user: string, org: string, target: AclTarget): Promise<Acl> {
  const { global, path } = where(target);
  return normalizeAcl(
    await cincRequest<unknown>({ user, org: global ? undefined : org, method: "GET", path }),
  );
}

/** Replace one permission's actors and groups (PUT …/_acl/<perm>). */
export function setPermission(
  user: string,
  org: string,
  target: AclTarget,
  perm: Perm,
  entry: AclEntry,
) {
  const { global, path } = where(target, perm);
  return cincRequest<unknown>({
    user,
    org: global ? undefined : org,
    method: "PUT",
    path,
    body: { [perm]: { actors: entry.actors, groups: entry.groups } },
  });
}

/** The org's containers: the object kinds whose ACL decides who may create them. */
export async function listContainers(user: string, org: string): Promise<string[]> {
  const res = await cincRequest<Record<string, string>>({
    user,
    org,
    method: "GET",
    path: cincPath`/containers`,
  });
  return Object.keys(res ?? {}).sort();
}
