import { permissionsHref } from "@/lib/acl-kinds";
import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { users } from "@/lib/cinc/users";
import { members, memberList } from "@/lib/cinc/members";
import { loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { getConfig } from "@/lib/config";
import { buttonClass } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailRow, DetailSheet } from "@/components/ui/detail-rows";
import { Badge } from "@/components/details/primitives";
import { ProfileList, ProfileRow, PasswordRow } from "@/app/profile/profile-rows";
import { KeyManager } from "@/components/keys/key-manager";
import { createKey, updateKey, regenerateKey, deleteKey } from "@/app/keys/actions";
import { removeUser } from "../../actions";
import { saveUserProfile, setUserPassword, setAdmin, deleteUser } from "../actions";
import { AdminToggle } from "./admin-toggle";
import { UserActions } from "./user-actions";

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/**
 * One member of the org, as one sheet of rows whose forms open on demand. The
 * full record (and so editing, the password and keys) is only readable by the
 * user, the superuser or a server admin; anyone else in the org sees the
 * member view, read-only.
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
    <div className="max-w-3xl space-y-5">
      {/* nosemgrep: js-open-redirect -- same-origin path */}
      <Link href={base} className="text-sm text-muted hover:text-text">
        ← back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight">
            {record.display_name || name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className="font-mono">{name}</span>
            <CopyButton value={name} label="Copy username" iconOnly />
            {admin !== null && <Badge tone={admin ? "primary" : "muted"}>{admin ? "Admin" : "Member"}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* nosemgrep: js-open-redirect -- same-origin path */}
          <Link href={permissionsHref(org, { kind: "users", name })} className={buttonClass("secondary")}>
            Permissions
          </Link>
          <UserActions
            org={org}
            name={name}
            admin={admin === true}
            backHref={base}
            onRemove={removeUser.bind(null, org, name)}
            onDelete={editable && name !== user ? deleteUser.bind(null, org, name) : undefined}
          />
        </div>
      </div>

      <DetailSheet>
        {editable ? (
          <ProfileRow initial={record} onSave={saveUserProfile.bind(null, org, name)} />
        ) : (
          <DetailRow label="Profile">
            <ProfileList data={record} />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <LockIcon />
              Only {name}, the superuser or a server administrator can change this
              profile, its password and its keys.
            </p>
          </DetailRow>
        )}

        {editable && (
          <PasswordRow
            authMode={authMode}
            self={name === user}
            onChange={setUserPassword.bind(null, org, name)}
          />
        )}

        {admin !== null && (
          <AdminToggle name={name} admin={admin} onChange={setAdmin.bind(null, org, name)} />
        )}

        {keysRes && (
          <DetailRow label={"data" in keysRes ? `Keys (${keysRes.data.length})` : "Keys"}>
            {"error" in keysRes ? (
              <p className="text-danger">{explainRead(keysRes.error)}</p>
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
          </DetailRow>
        )}
      </DetailSheet>
    </div>
  );
}
