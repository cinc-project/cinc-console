import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

export type Org = { name: string; full_name?: string };

type OrgEnvelope = { organization: { name: string; full_name?: string } };

/** The organizations a user belongs to (GET /users/<user>/organizations). */
export async function listUserOrgs(user: string): Promise<Org[]> {
  const raw = await cincRequest<OrgEnvelope[]>({
    user,
    method: "GET",
    path: cincPath`/users/${user}/organizations`,
  });
  return raw.map((o) => ({
    name: o.organization.name,
    full_name: o.organization.full_name,
  }));
}
