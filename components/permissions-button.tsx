"use client";

import Link from "next/link";
import { buttonClass } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

/**
 * An object's Permissions button. When the server refused to show its ACL
 * (`denied`, the reason), it's greyed out and not a link, but stays focusable
 * so keyboard and screen-reader users reach the tooltip saying why.
 */
export function PermissionsButton({ href, denied }: { href: string; denied?: string }) {
  if (!denied) {
    return (
      // nosemgrep: js-open-redirect -- same-origin path
      <Link href={href} className={buttonClass("secondary")}>
        Permissions
      </Link>
    );
  }
  return (
    <Tooltip content={denied}>
      {(describedBy) => (
        <span
          role="link"
          aria-disabled="true"
          tabIndex={0}
          aria-describedby={describedBy}
          className={buttonClass("secondary")}
        >
          Permissions
        </span>
      )}
    </Tooltip>
  );
}
