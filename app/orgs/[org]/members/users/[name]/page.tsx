import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { users, type User } from "@/lib/cinc/users";
import { members, memberList } from "@/lib/cinc/members";
import { loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { getConfig } from "@/lib/config";
import { ProfileForm } from "@/app/profile/profile-form";
import { KeyManager } from "@/components/keys/key-manager";
import { createKey, updateKey, regenerateKey, deleteKey } from "@/app/keys/actions";
import { RemoveUserButton } from "../../remove-user-button";
import { removeUser } from "../../actions";
import { saveUserProfile, setUserPassword, setAdmin, deleteUser } from "../actions";
import { AdminToggle } from "./admin-toggle";
import { DeleteUserButton } from "./delete-user-button";

function ReadOnlyProfile({ data }: { data: User }) {
  const rows: Array<[string, unknown]> = [
    ["Display name", data.display_name],
    ["First name", data.first_name],
    ["Last name", data.last_name],
    ["Email", data.email],
  ];
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="text-text">{typeof value === "string" && value ? value : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One member of the org. The full record (and so editing, the password and
 * keys) is only readable by the user, the superuser or a server admin; anyone
 * else in the org sees the member view, read-only.
 */
export default async function UserDetail({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name: raw } = await params;
  const name = decodeURIComponent(raw);
  const user = await currentUser();
  const base = `/orgs/${org}/members`;
  const { authMode } = getConfig();
  const owner: KeyOwner = { kind: "user", name };

  const [fullRes, adminsRes] = await Promise.all([
    safeGet(() => users.get(user, name)),
    safeGet(() => members.getGroup(user, org, "admins")),
  ]);
  const editable = "data" in fullRes;
  const recordRes = editable ? fullRes : await safeGet(() => users.getMember(user, org, name));
  if ("error" in recordRes) {
    return (
      <div className="space-y-4">
        <Link href={base} className="text-sm text-muted hover:text-text">
          ← back
        </Link>
        <p className="text-sm text-danger">{explainRead(recordRes.error)}</p>
      </div>
    );
  }
  const record = recordRes.data;
  const keysRes = editable ? await safeGet(() => loadKeys(user, owner)) : null;
  const admin = "data" in adminsRes ? memberList(adminsRes.data, "users").includes(name) : null;

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-1">
        <Link href={base} className="text-sm text-muted hover:text-text">
          ← back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {record.display_name || name}
        </h1>
        <p className="font-mono text-sm text-muted">{name}</p>
      </div>

      <section className="space-y-4" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-lg font-semibold tracking-tight">
          Profile
        </h2>
        {editable ? (
          <ProfileForm
            initial={record}
            authMode={authMode}
            self={name === user}
            onSaveDetails={saveUserProfile.bind(null, org, name)}
            onChangePassword={setUserPassword.bind(null, org, name)}
          />
        ) : (
          <>
            <ReadOnlyProfile data={record} />
            <p className="text-sm text-muted">
              Only {name}, the superuser or a server administrator can change
              this profile, its password and its keys.
            </p>
          </>
        )}
      </section>

      {admin !== null && (
        <section className="space-y-4" aria-labelledby="role-heading">
          <h2 id="role-heading" className="text-lg font-semibold tracking-tight">
            Role in {org}
          </h2>
          <AdminToggle name={name} admin={admin} onChange={setAdmin.bind(null, org, name)} />
        </section>
      )}

      {keysRes && (
        <section className="space-y-4" aria-labelledby="keys-heading">
          <h2 id="keys-heading" className="text-lg font-semibold tracking-tight">
            Keys
          </h2>
          {"error" in keysRes ? (
            <p className="text-sm text-danger">{explainRead(keysRes.error)}</p>
          ) : (
            <KeyManager
              owner={name}
              rows={keysRes.data}
              onCreate={createKey.bind(null, owner)}
              onUpdate={updateKey.bind(null, owner)}
              onRegenerate={regenerateKey.bind(null, owner)}
              onDelete={deleteKey.bind(null, owner)}
            />
          )}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="text-lg font-semibold tracking-tight">
          Membership
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <RemoveUserButton
            username={name}
            admin={admin === true}
            onRemove={removeUser.bind(null, org, name)}
            label="Remove from organization"
            redirectTo={base}
          />
          {editable && name !== user && (
            <DeleteUserButton
              name={name}
              backHref={base}
              onDelete={deleteUser.bind(null, org, name)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
