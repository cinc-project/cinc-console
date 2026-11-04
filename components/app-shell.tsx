"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Org } from "@/lib/cinc/orgs";
import { OrgSwitcher } from "@/components/org-switcher";
import { UserMenu } from "@/components/user-menu";
import { CommandPalette } from "@/components/command-palette";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SiteFooter } from "@/components/site-footer";
import { PrimaryNavLinks } from "@/components/primary-nav";
import { MobileNav } from "@/components/mobile-nav";

export function AppShell({
  org,
  orgs,
  displayName,
  version,
  children,
}: {
  org: string;
  orgs: Org[];
  displayName: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip link (WCAG 2.4.1): hidden until focused, lets keyboard users
          jump past the header and nav straight to the page content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <MobileNav org={org} displayName={displayName} />
          <Link
            href="/orgs"
            className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Image
              src="/cinc/logo-icon.png"
              alt="Cinc"
              width={22}
              height={22}
              priority
              unoptimized
            />
            <span className="hidden text-text min-[400px]:inline">console</span>
          </Link>
          <OrgSwitcher orgs={orgs} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CommandPalette org={org} orgs={orgs} />
          {/* Below md the user menu lives in the MobileNav drawer. */}
          <div className="hidden md:block">
            <UserMenu name={displayName} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* From md the sidebar; below that the same links live in the
            MobileNav drawer opened from the header. */}
        <nav
          aria-label="Primary"
          className="hidden w-48 shrink-0 border-r border-border bg-surface p-3 md:block"
        >
          <PrimaryNavLinks org={org} />
        </nav>

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <SiteFooter version={version} />
    </div>
  );
}
