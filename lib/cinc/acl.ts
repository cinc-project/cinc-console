import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

export type Acl = Record<string, { actors: string[]; groups: string[] }>;

/** Fetch an object's ACL (GET /<kind>/<name>/_acl). */
export function getAcl(user: string, org: string, kind: string, name: string) {
  return cincRequest<Acl>({
    user,
    org,
    method: "GET",
    path: cincPath`/${kind}/${name}/_acl`,
  });
}
