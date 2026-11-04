import { cn } from "@/lib/utils";

const LICENSE_URL =
  "https://github.com/cinc-project/cinc-console/blob/main/LICENSE";
const RELEASES_URL = "https://github.com/cinc-project/cinc-console/releases";

const LINK = "text-link underline underline-offset-2 hover:text-text";

/**
 * Copyright/license footer shared by every page. `version` is passed only on
 * signed-in pages — the login page doesn't advertise the build to anonymous
 * visitors.
 */
export function SiteFooter({ version }: { version?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border px-6 py-4 text-xs text-muted",
        version
          ? "flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left"
          : "text-center",
      )}
    >
      <p>
        © 2026 Tim Smith. Licensed under the{" "}
        <a href={LICENSE_URL} className={LINK}>
          Business Source License 1.1
        </a>
        . Cinc Is Not Chef ·{" "}
        <a href="https://cinc.sh/" className={LINK}>
          cinc.sh
        </a>
      </p>
      {version && (
        <p>
          <a
            href={`${RELEASES_URL}/tag/v${version}`}
            className={cn(LINK, "font-mono")}
          >
            cinc-console v{version}
          </a>
        </p>
      )}
    </footer>
  );
}
