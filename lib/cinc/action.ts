import "server-only";
import { revalidatePath } from "next/cache";
import { isCincError } from "./errors";
import { isUnsafePathError } from "./path";

export type ActionResult = { ok: true } | { error: string };

/**
 * Run a cinc mutation and translate server errors into a UI-friendly result.
 * 403 (the server's ACL gate) becomes "forbidden" so the UI can explain it
 * rather than crashing.
 *
 * On success, `revalidate` invalidates that route subtree (as a layout, so both
 * the list and its detail pages refresh) — without it a deleted object lingers
 * in a cached list and `router.refresh()` alone races the navigation.
 */
export async function runAction(
  fn: () => Promise<unknown>,
  opts: { revalidate?: string } = {},
): Promise<ActionResult> {
  try {
    await fn();
    if (opts.revalidate) revalidatePath(opts.revalidate, "layout");
    return { ok: true };
  } catch (e) {
    if (isCincError(e)) {
      if (e.forbidden) return { error: "forbidden" };
      if (e.notFound) return { error: "not found" };
      if (e.conflict) return { error: "already exists" };
      return { error: `server error (${e.status})` };
    }
    // A name that can't be addressed safely (see path.ts) is user input, not a
    // crash: report it like any other rejected mutation.
    if (isUnsafePathError(e)) return { error: "invalid name" };
    throw e;
  }
}

export function parseJsonObject(
  json: string,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const value = JSON.parse(json);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ok: true, value };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
