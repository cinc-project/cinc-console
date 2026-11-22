import { currentUser } from "@/lib/guard";
import { members, memberList } from "@/lib/cinc/members";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { InviteForm } from "./invite-form";
import { UsersList, GroupsList } from "./sortable-lists";
import { PendingInvites } from "./pending-invites";
import { inviteUser, removeUser, cancelInvite } from "./actions";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const user = await currentUser();
  const base = `/orgs/${org}/members`;

  const [usersRes, groupsRes, invitesRes, adminsRes] = await Promise.all([
    safeGet(() => members.listUsers(user, org)),
    safeGet(() => members.listGroups(user, org)),
    safeGet(() => members.listInvites(user, org)),
    // Only admins can read the admins group; for anyone else roles stay unknown.
    safeGet(() => members.getGroup(user, org, "admins")),
  ]);
  const admins = "data" in adminsRes ? new Set(memberList(adminsRes.data, "users")) : null;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <InviteForm onInvite={inviteUser.bind(null, org)} />
        {"error" in usersRes ? (
          <p className="text-sm text-danger">{explainRead(usersRes.error)}</p>
        ) : usersRes.data.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <p className="p-4 text-sm text-muted">No users.</p>
          </div>
        ) : (
          <UsersList
            items={usersRes.data.map((d) => ({
              name: d.user.username,
              admin: admins ? admins.has(d.user.username) : null,
              onRemove: removeUser.bind(null, org, d.user.username),
            }))}
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Pending invitations</h2>
        {"error" in invitesRes ? (
          <p className="text-sm text-danger">{explainRead(invitesRes.error)}</p>
        ) : invitesRes.data.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <p className="p-4 text-sm text-muted">No pending invitations.</p>
          </div>
        ) : (
          <PendingInvites
            items={invitesRes.data.map((i) => ({
              username: i.username,
              onCancel: cancelInvite.bind(null, org, i.id),
            }))}
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Groups</h2>
        {"error" in groupsRes ? (
          <p className="text-sm text-danger">{explainRead(groupsRes.error)}</p>
        ) : Object.keys(groupsRes.data).length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <p className="p-4 text-sm text-muted">No groups.</p>
          </div>
        ) : (
          <GroupsList basePath={base} names={Object.keys(groupsRes.data)} />
        )}
      </section>
    </div>
  );
}
