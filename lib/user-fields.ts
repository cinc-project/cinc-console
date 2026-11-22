/**
 * User record fields the console may write, and the server's rules for a new
 * user. Client-safe (no server imports) so the forms and the server actions
 * apply the same checks.
 */
export type ProfileDetails = {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

/**
 * The only profile fields a form may write. A Server Action is a public
 * endpoint and its parameter type is erased at runtime, so a caller can hand
 * us any object it likes; spreading that onto the user record would let it set
 * fields the UI never exposes (`password`, `admin`, `public_key`, the
 * recovery/external-auth flags) on a request signed with the trusted webui
 * key. Pick, don't spread.
 */
const PROFILE_FIELDS = [
  "display_name",
  "first_name",
  "last_name",
  "email",
] as const satisfies readonly (keyof ProfileDetails)[];

export function pickProfileFields(details: ProfileDetails): ProfileDetails {
  const out: ProfileDetails = {};
  for (const field of PROFILE_FIELDS) {
    const value = details?.[field];
    if (typeof value === "string") out[field] = value;
  }
  return out;
}

/** Usernames, as the server requires them: lowercase letters, digits, _ and -. */
export const USERNAME = /^[a-z0-9_-]+$/;

/** The server's minimum for a local password. */
export const MIN_PASSWORD = 6;

export type NewUserFields = ProfileDetails & { username: string; password?: string };

/**
 * Why the server would reject this new user, or null. A display name and an
 * email are required; so is a password unless the user signs in through LDAP.
 */
export function newUserError(u: NewUserFields, opts: { needsPassword: boolean }): string | null {
  if (typeof u?.username !== "string" || !USERNAME.test(u.username)) return "invalid username";
  if (typeof u.display_name !== "string" || !u.display_name.trim()) return "display name required";
  if (typeof u.email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(u.email.trim())) return "invalid email";
  if (opts.needsPassword && (typeof u.password !== "string" || u.password.length < MIN_PASSWORD)) {
    return "password too short";
  }
  return null;
}
