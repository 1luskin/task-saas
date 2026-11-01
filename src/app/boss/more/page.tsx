import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { LogoutButton } from "@/components/logout-button";
import { IconArchive, IconChart, IconChevronRight, IconInbox, IconRepeat, IconSettings } from "@/components/icons";

export default async function MorePage() {
  const { t } = await getI18n();
  const items = [
    { href: "/boss/requests", label: t("nav.requests"), icon: IconInbox },
    { href: "/boss/templates", label: t("nav.templates"), icon: IconRepeat },
    { href: "/boss/reports", label: t("nav.reports"), icon: IconChart },
    { href: "/boss/archive", label: t("nav.archive"), icon: IconArchive },
    { href: "/boss/settings", label: t("nav.settings"), icon: IconSettings },
  ];
  return (
    <div className="space-y-4">
      <div className="card-white divide-y divide-line/70 overflow-hidden">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-card">
            <i.icon className="size-6 text-accent" />
            <span className="flex-1 text-[17px]">{i.label}</span>
            <IconChevronRight className="size-5 text-muted" />
          </Link>
        ))}
      </div>
      <div className="card-white p-2">
        <LogoutButton />
      </div>
    </div>
  );
}
