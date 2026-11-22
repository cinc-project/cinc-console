import Link from "next/link";
import Image from "next/image";
import { currentSession } from "@/lib/guard";
import { getUser } from "@/lib/cinc/users";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { getConfig } from "@/lib/config";
import { UserMenu } from "@/components/user-menu";
import { SiteFooter } from "@/components/site-footer";
import { APP_VERSION } from "@/lib/version";
import { ProfileRow, PasswordRow } from "./profile-rows";
import { DetailRow, DetailSheet } from "@/components/ui/detail-rows";
import { loadKeys, type KeyOwner } from "@/lib/cinc/keys";
import { KeyManager } from "@/components/keys/key-manager";
import { createKey, updateKey, regenerateKey, deleteKey } from "@/app/keys/actions";

export default async function ProfilePage() {
  const { username, displayName } = await currentSession();
  const owner: KeyOwner = { kind: "user", name: username };
  const [res, keysRes] = await Promise.all([
    safeGet(() => getUser(username)),
    safeGet(() => loadKeys(username, owner)),
  ]);
  const { authMode } = getConfig();

  return (
    <div className="flex min-h-screen flex-col">
    <main className="flex-1">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <Link
          href="/orgs"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Image
            src="/cinc/logo-icon.png"
            alt="Cinc"
            width={22}
            height={22}
            priority
            unoptimized
          />
          <span className="text-text">console</span>
        </Link>
        <UserMenu name={displayName} />
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">
          Your profile
        </h1>
        <p className="mb-6 font-mono text-sm text-muted">{username}</p>
        <DetailSheet>
          {"error" in res ? (
            <DetailRow label="Profile">
              <p className="text-danger">{explainRead(res.error)}</p>
            </DetailRow>
          ) : (
            <ProfileRow initial={res.data} />
          )}
          <PasswordRow authMode={authMode} />
          <DetailRow label={"data" in keysRes ? `Keys (${keysRes.data.length})` : "Keys"}>
            <p className="mb-3 text-muted">
              Tools such as cinc-cli and knife sign their requests with one of these keys.
            </p>
            {"error" in keysRes ? (
              <p className="text-danger">{explainRead(keysRes.error)}</p>
            ) : (
              <KeyManager
                owner={username}
                rows={keysRes.data}
                onCreate={createKey.bind(null, owner)}
                onUpdate={updateKey.bind(null, owner)}
                onRegenerate={regenerateKey.bind(null, owner)}
                onDelete={deleteKey.bind(null, owner)}
              />
            )}
          </DetailRow>
        </DetailSheet>
      </div>
    </main>
    <SiteFooter version={APP_VERSION} />
    </div>
  );
}
