import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

/**
 * The invitee's side of an org invitation. An org admin invites with
 * POST /organizations/<org>/association_requests; the user isn't a member until
 * they accept it here. Only the user themselves (or the superuser) may list or
 * answer their invitations.
 */
export type MyInvite = { id: string; orgname: string };

export const listMyInvites = (user: string) =>
  cincRequest<MyInvite[]>({
    user,
    method: "GET",
    path: cincPath`/users/${user}/association_requests`,
  });

export const respondToInvite = (
  user: string,
  id: string,
  response: "accept" | "reject",
) =>
  cincRequest<unknown>({
    user,
    method: "PUT",
    path: cincPath`/users/${user}/association_requests/${id}`,
    body: { response },
  });
