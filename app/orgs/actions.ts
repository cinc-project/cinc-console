"use server";

import { requireUser } from "@/lib/session";
import { respondToInvite } from "@/lib/cinc/invitations";
import { runAction, type ActionResult } from "@/lib/cinc/action";

/**
 * Answer one of the signed-in user's org invitations. The id is the only input
 * from the browser; the server only lets a user answer their own invitations,
 * and the user here always comes from the session.
 */
async function respond(id: string, response: "accept" | "reject"): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof id !== "string") return { error: "invalid name" };
  return runAction(() => respondToInvite(user, id, response), { revalidate: "/orgs" });
}

export async function acceptInvite(id: string): Promise<ActionResult> {
  return respond(id, "accept");
}

export async function declineInvite(id: string): Promise<ActionResult> {
  return respond(id, "reject");
}
