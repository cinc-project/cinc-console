import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover font-medium",
  secondary:
    "bg-surface-2 text-text border border-border hover:border-muted",
  danger: "bg-danger-strong text-white hover:brightness-110 font-medium",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
};

/**
 * Button styling as a class string, for a `Link` that should look like a
 * button — wrapping a <button> in an <a> nests two interactive elements.
 */
export function buttonClass(variant: Variant = "primary", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
