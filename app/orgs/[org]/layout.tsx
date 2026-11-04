import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { currentSession } from "@/lib/guard";
import { listUserOrgs } from "@/lib/cinc/orgs";
import { AppShell } from "@/components/app-shell";
import { APP_VERSION } from "@/lib/version";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { username, displayName } = await currentSession();
  const { org } = await params;
  // If we can list the user's orgs, a slug that isn't one of them is a 404 —
  // otherwise a bogus org like /orgs/typo would render the whole shell and only
  // fail object-by-object. If the orgs call itself fails (transient), degrade:
  // assume the slug is valid and let the inner pages surface real errors.
  const orgs = await listUserOrgs(username).catch(() => null);
  if (orgs && !orgs.some((o) => o.name === org)) {
    notFound();
  }

  return (
    <AppShell org={org} orgs={orgs ?? [{ name: org }]} displayName={displayName}
      version={APP_VERSION}
    >
      {children}
    </AppShell>
  );
}
