import "server-only";
import { isCincError } from "./errors";
import { isUnsafePathError } from "./path";

export type Fetched<T> = { data: T } | { error: string };

/** Run a read against the server, mapping ACL/availability errors to a string. */
export async function safeGet<T>(fn: () => Promise<T>): Promise<Fetched<T>> {
  try {
    return { data: await fn() };
  } catch (e) {
    if (isCincError(e)) {
      if (e.forbidden) return { error: "forbidden" };
      if (e.notFound) return { error: "not found" };
      return { error: `server error (${e.status})` };
    }
    // An unaddressable name (see path.ts) is a bad request, not an outage — a
    // hand-typed URL like /nodes/web01%2F_acl lands here.
    if (isUnsafePathError(e)) return { error: "invalid name" };
    throw e;
  }
}

export function explainRead(error: string): string {
  if (error === "invalid name")
    return "That name can't be addressed on the Cinc server — check the URL.";
  if (error === "forbidden")
    return "You don't have permission to view this in this organization.";
  if (error === "not found")
    return "This no longer exists, or you don't have access to it.";
  if (error.startsWith("server error"))
    return `The Cinc server returned an error (${error.replace(/\D/g, "") || "5xx"}). This is usually transient — reload to try again.`;
  return error;
}
