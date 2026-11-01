"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

export function NavLink({ href, exact, children, variant }: { href: string; exact?: boolean; children: React.ReactNode; variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        className={cx(
          "flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium",
          active ? "text-accent" : "text-muted",
        )}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium transition",
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
