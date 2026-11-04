import Link from "next/link";
import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { NavLink } from "@/components/shell/nav-link";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/** /admin – nur für SUPERADMIN_EMAILS (Prüfung auf dem Server, sonst 404) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperadmin();
  const { t } = await getI18n();
  const nav = [
    { href: "/admin", label: t("admin.overview"), exact: true },
    { href: "/admin/content", label: t("admin.content") },
    { href: "/admin/reviews", label: t("admin.reviews") },
    { href: "/admin/flags", label: t("admin.flags") },
    { href: "/admin/audit", label: t("admin.audit") },
  ];
  return (
    <div className="min-h-dvh bg-bg-deep">
      <header className="border-b border-line/60 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Link href="/admin" className="font-display text-lg font-semibold">{t("admin.title")}</Link>
          <nav className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact} variant="side">{n.label}</NavLink>
            ))}
          </nav>
          <span className="ml-auto text-sm text-muted">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
