import Link from "next/link";
import { APP_NAME } from "@/config/app";

const LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/avv", label: "AVV" },
];

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted ${className}`}>
      <span>© {new Date().getFullYear()} {APP_NAME}</span>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center hover:text-ink">
          {l.label}
        </Link>
      ))}
    </footer>
  );
}
