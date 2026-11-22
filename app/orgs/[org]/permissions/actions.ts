"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { setPermission, type AclEntry } from "@/lib/cinc/acl";
import { isCincError, serverReason } from "@/lib/cinc/errors";
import { isUnsafePathError } from "@/lib/cinc/path";
import type { ActionResult } from "@/lib/cinc/action";
import { isAclKind, isPerm, type AclTarget, type Perm } from "@/lib/acl-kinds";

function validTarget(t: unknown): t is AclTarget {
  if (!t || typeof t !== "object") return false;
  const v = t as Record<string, unknown>;
  return v.kind === "organization" || (isAclKind(v.kind) && typeof v.name === "string" && v.name !== "");
}

/** Trimmed, de-duplicated, non-empty names, or null if `v` isn't a string list. */
function names(v: unknown): string[] | null {
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) return null;
  return [...new Set(v.map((s: string) => s.trim()).filter(Boolean))];
}

/**
 * Replace one permission of a target's ACL. The target is bound on the server,
 * but a Server Action's arguments are untrusted, so all of it is checked. The
 * server checks `grant` and that every actor and group exists, and refuses to
 * take `admins` out of `grant` for anyone but the superuser.
 */
export async function savePermission(
  org: string,
  target: AclTarget,
  perm: Perm,
  entry: AclEntry,
): Promise<ActionResult> {
  const user = await requireUser();
  const actors = names(entry?.actors);
  const groups = names(entry?.groups);
  if (!validTarget(target) || !isPerm(perm) || !actors || !groups) return { error: "invalid target" };
  try {
    await setPermission(user, org, target, perm, { actors, groups });
  } catch (e) {
    if (isCincError(e)) {
      if (e.forbidden) {
        // The server's refusal reads "Admin group cannot be removed from the
        // Grant ACE" (erchef's wording, which cinc-server-ng copies).
        const why = serverReason(e.body) ?? "";
        return perm === "grant" && /admin group cannot be removed/i.test(why)
          ? { error: "admins grant" }
          : { error: "forbidden" };
      }
      if (e.notFound) return { error: "not found" };
      const reason = e.status === 400 ? serverReason(e.body) : null;
      return { error: reason ? `The server rejected this: ${reason}` : `server error (${e.status})` };
    }
    if (isUnsafePathError(e)) return { error: "invalid name" };
    throw e;
  }
  revalidatePath(`/orgs/${org}/permissions`, "layout");
  return { ok: true };
}
