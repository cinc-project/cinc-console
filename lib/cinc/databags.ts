import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

/**
 * Data bags are a two-level org-scoped object family:
 *   GET    /data                  → { bag: url, ... }
 *   POST   /data                  → create a bag
 *   DELETE /data/<bag>            → delete a bag
 *   GET    /data/<bag>           → { item: url, ... }
 *   GET    /data/<bag>/<id>      → item object
 *   POST   /data/<bag>          → create an item
 *   PUT    /data/<bag>/<id>     → replace an item
 *   DELETE /data/<bag>/<id>     → delete an item
 */
export const dataBags = {
  list: (u: string, o: string) =>
    cincRequest<Record<string, string>>({
      user: u,
      org: o,
      method: "GET",
      path: cincPath`/data`,
    }),
  createBag: (u: string, o: string, name: string) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "POST",
      path: cincPath`/data`,
      body: { name },
    }),
  removeBag: (u: string, o: string, name: string) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "DELETE",
      path: cincPath`/data/${name}`,
    }),
  listItems: (u: string, o: string, bag: string) =>
    cincRequest<Record<string, string>>({
      user: u,
      org: o,
      method: "GET",
      path: cincPath`/data/${bag}`,
    }),
  getItem: (u: string, o: string, bag: string, id: string) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "GET",
      path: cincPath`/data/${bag}/${id}`,
    }),
  putItem: (u: string, o: string, bag: string, id: string, body: Record<string, unknown>) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "PUT",
      path: cincPath`/data/${bag}/${id}`,
      body,
    }),
  createItem: (u: string, o: string, bag: string, body: Record<string, unknown>) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "POST",
      path: cincPath`/data/${bag}`,
      body,
    }),
  removeItem: (u: string, o: string, bag: string, id: string) =>
    cincRequest<unknown>({
      user: u,
      org: o,
      method: "DELETE",
      path: cincPath`/data/${bag}/${id}`,
    }),
};
