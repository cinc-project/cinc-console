import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";
import { isCincError } from "./errors";
import { getUser } from "./users";
import { getConfig } from "../config";
import { ldapBind, LdapAuthError } from "../ldap/client";
import { log } from "../log";

export type AuthUser = {
  username: string;
  display_name?: string;
  [k: string]: unknown;
};

/**
 * Validate a username/password against the server by signing a top-level
 * POST /authenticate_user with the webui key. Returns the authenticated user
 * (the endpoint echoes the user record, including display_name) on success,
 * null on bad credentials (401), and rethrows anything else.
 *
 * /authenticate_user is a global (non-org) endpoint. Its ACL typically only
 * grants "create" to globally-privileged actors (e.g. pivotal). Org-level
 * users — even org admins — do not have global create permission and will
 * receive 403. CINC_AUTH_ACTOR must be set to a globally-privileged actor
 * (e.g. "pivotal") so the webui-signed request is accepted.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthUser | null> {
  // The signing actor (X-Ops-UserId) must have global "create" on
  // /authenticate_user. Org-level users won't have this; use authActor
  // (e.g. "pivotal") when configured, otherwise fall back to the user's
  // own name (works on servers that grant broader global permissions).
  const { authActor } = getConfig();
  const signingUser = authActor ?? username;

  try {
    const res = await cincRequest<{ user?: AuthUser }>({
      user: signingUser,
      onBehalfOf: username,
      method: "POST",
      path: cincPath`/authenticate_user`,
      body: { username, password },
    });
    return res?.user ?? { username };
  } catch (e) {
    if (isCincError(e) && e.status === 401) return null;
    throw e;
  }
}

export type AuthResult = { username: string; displayName?: string };

/**
 * Verify credentials and return the identity to put in the session, or null
 * on any authentication failure. Branches on AUTH_MODE:
 *
 * - "local" (default): delegates to authenticateUser() above, unchanged.
 * - "ldap": binds against the configured directory (lib/ldap/client.ts) to
 *   prove the password, then looks up the Cinc user record for display_name.
 *   LDAP never provisions Cinc users — a successful bind for a username with
 *   no matching Cinc user object fails the login (there's no ACL target to
 *   impersonate), logged distinctly from a bad password so operators can
 *   tell a provisioning gap apart from a mistyped password or a directory
 *   outage.
 */
export async function authenticate(
  username: string,
  password: string,
): Promise<AuthResult | null> {
  const { authMode } = getConfig();

  if (authMode !== "ldap") {
    const authUser = await authenticateUser(username, password);
    return authUser ? { username, displayName: authUser.display_name || username } : null;
  }

  try {
    await ldapBind(username, password);
  } catch (e) {
    if (!(e instanceof LdapAuthError)) throw e;
    if (e.reason === "connection_error") {
      log.error("auth.ldap_unavailable", { user: username, reason: e.message });
    } else {
      log.warn("auth.ldap_failed", { user: username, reason: e.reason });
    }
    return null;
  }

  // LDAP proved the identity; Cinc ACLs are keyed by the Cinc user object.
  // getUser signs as the target username itself (self-read), same as any
  // other resource call — the server's own ACLs decide, the console doesn't
  // second-guess it.
  try {
    const chefUser = await getUser(username);
    return { username, displayName: chefUser.display_name || username };
  } catch (e) {
    if (isCincError(e) && e.notFound) {
      log.error("auth.ldap_ok_no_chef_user", { user: username });
      return null; // fail closed — no session for an identity with no ACL target
    }
    throw e; // real backend errors (403/500) are not "login failed"
  }
}
