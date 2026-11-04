import { cn } from "@/lib/utils";

const LICENSE_URL =
  "https://github.com/cinc-project/cinc-console/blob/main/LICENSE";
const RELEASES_URL = "https://github.com/cinc-project/cinc-console/releases";

const LINK = "text-link underline underline-offset-2 hover:text-text";

/**
 * Copyright/license footer shared by every page: copyright and license on the
 * left, the cinc.sh link on the right (stacked and centered on phones).
 * `version` is passed only on signed-in pages — the login page doesn't
 * advertise the build to anonymous visitors.
 */
export function SiteFooter({ version }: { version?: string }) {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-border px-6 py-4 text-center text-xs text-muted sm:flex-row sm:justify-between sm:text-left">
      <p>
        © 2026 Tim Smith &amp; Cinc Project. Licensed under the{" "}
        <a href={LICENSE_URL} className={LINK}>
          Apache License 2.0
        </a>
        .
      </p>
      <p className="flex items-center gap-2">
        {version && (
          <>
            <a
              href={`${RELEASES_URL}/tag/v${version}`}
              className={cn(LINK, "font-mono")}
            >
              cinc-console v{version}
            </a>
            <span aria-hidden="true">·</span>
          </>
        )}
        <a href="https://cinc.sh/" className={LINK}>
          cinc.sh
        </a>
      </p>
    </footer>
  );
}
