import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

/**
 * A read-only org-scoped object family living at /<kind>. Browsing only —
 * no create/update/delete — used for cookbooks, policies, and clients.
 */
function readOnlyResource(kind: string) {
  return {
    list: (u: string, o: string) =>
      cincRequest<Record<string, unknown>>({
        user: u,
        org: o,
        method: "GET",
        path: cincPath`/${kind}`,
      }),
    get: (u: string, o: string, name: string) =>
      cincRequest<unknown>({
        user: u,
        org: o,
        method: "GET",
        path: cincPath`/${kind}/${name}`,
      }),
  };
}

export const cookbooks = readOnlyResource("cookbooks");
export const policies = readOnlyResource("policies");
export const clients = readOnlyResource("clients");
