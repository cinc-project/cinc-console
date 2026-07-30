import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";
import { isCincError } from "./errors";
import { getConfig } from "../config";

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
