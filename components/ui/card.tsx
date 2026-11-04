import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Surface card. `flush` drops the built-in padding for cards whose contents
 * (a list header, table rows) bring their own edge-to-edge padding — a
 * `className="p-0"` override can't do that, because `cn` only joins classes
 * and the generated CSS order, not the class order, decides which padding wins.
 */
export function Card({
  className,
  flush = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)]",
        !flush && "p-5",
        className,
      )}
      {...props}
    />
  );
}
