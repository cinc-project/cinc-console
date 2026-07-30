import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

/**
 * A standard Chef org-scoped object family living at /<kind>:
 *   GET    /<kind>            → { name: url, ... }
 *   GET    /<kind>/<name>     → object
 *   POST   /<kind>            → create
 *   PUT    /<kind>/<name>     → replace
 *   DELETE /<kind>/<name>     → delete
 */
export function makeResource<T = Record<string, unknown>>(kind: string) {
  return {
    kind,
    list: (user: string, org: string) =>
      cincRequest<Record<string, string>>({
        user,
        org,
        method: "GET",
        path: cincPath`/${kind}`,
      }),
    get: (user: string, org: string, name: string) =>
      cincRequest<T>({ user, org, method: "GET", path: cincPath`/${kind}/${name}` }),
    create: (user: string, org: string, body: T) =>
      cincRequest<unknown>({ user, org, method: "POST", path: cincPath`/${kind}`, body }),
    update: (user: string, org: string, name: string, body: T) =>
      cincRequest<unknown>({
        user,
        org,
        method: "PUT",
        path: cincPath`/${kind}/${name}`,
        body,
      }),
    remove: (user: string, org: string, name: string) =>
      cincRequest<unknown>({
        user,
        org,
        method: "DELETE",
        path: cincPath`/${kind}/${name}`,
      }),
  };
}

export type Resource<T = Record<string, unknown>> = ReturnType<
  typeof makeResource<T>
>;
