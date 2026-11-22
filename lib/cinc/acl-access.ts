import "server-only";
import { getAcl } from "./acl";
import { safeGet } from "./safe-get";
import { permissionsDeniedText, type AclTarget } from "@/lib/acl-kinds";

/**
 * Whether the server lets `user` read the target's ACL (it needs grant). Only
 * a 403 says no: any other failure leaves the permissions page reachable to
 * explain itself.
 */
export async function canViewAcl(user: string, org: string, target: AclTarget): Promise<boolean> {
  try {
    const res = await safeGet(() => getAcl(user, org, target));
    return !("error" in res && res.error === "forbidden");
  } catch {
    return true;
  }
}

/** The disabled Permissions button's tooltip, or undefined when it's enabled. */
export async function permissionsDenied(
  user: string,
  org: string,
  target: AclTarget,
): Promise<string | undefined> {
  return (await canViewAcl(user, org, target)) ? undefined : permissionsDeniedText(target);
}
