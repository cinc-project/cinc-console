import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/guard";
import { listUserOrgs } from "@/lib/cinc/orgs";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { Card } from "@/components/ui/card";
import { UserMenu } from "@/components/user-menu";
import { SiteFooter } from "@/components/site-footer";
import { APP_VERSION } from "@/lib/version";

export default async function OrgsPage() {
  const { username, displayName } = await currentSession();
  const res = await safeGet(() => listUserOrgs(username));

  // With a single org there's nothing to pick — go straight in.
  if ("data" in res && res.data.length === 1) {
    redirect(`/orgs/${res.data[0].name}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
    <main className="flex-1">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Image
            src="/cinc/logo-icon.png"
            alt="Cinc"
            width={22}
            height={22}
            priority
            unoptimized
          />
          <span className="text-text">console</span>
        </div>
        <UserMenu name={displayName} />
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <h2 className="mb-4 text-sm uppercase tracking-wide text-muted">
          Your organizations
        </h2>

        {"error" in res ? (
          <p className="text-sm text-danger">{explainRead(res.error)}</p>
        ) : res.data.length === 0 ? (
          <p className="text-muted">
            You don&apos;t belong to any organizations.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {res.data.map((o) => (
              <Link key={o.name} href={`/orgs/${o.name}`}>
                <Card className="transition-colors hover:border-primary">
                  <div className="font-medium">{o.full_name ?? o.name}</div>
                  <div className="text-sm text-muted">{o.name}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
    <SiteFooter version={APP_VERSION} />
    </div>
  );
}
