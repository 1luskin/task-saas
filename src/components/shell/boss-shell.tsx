import Link from "next/link";
import { APP_NAME } from "@/config/app";
import { getI18n } from "@/i18n/server";
import { NavLink } from "./nav-link";
import { OfflineBanner } from "./offline-banner";
import { DemoFirmBar } from "../demo/demo-firm-bar";
import { ExpiredBanner, TrialCard } from "../trial/trial";
import type { Ctx } from "@/lib/auth";
import { LogoutButton } from "../logout-button";
import { Avatar } from "../ui";
import {
  IconArchive, IconCalendar, IconChart, IconEuro, IconInbox, IconMenu, IconRepeat, IconSettings, IconTasks, IconUsers,
} from "../icons";

export async function BossShell({
  ctx, pendingRequests, children,
}: { ctx: Ctx; pendingRequests: number; children: React.ReactNode }) {
  const firmName = ctx.firm.name;
  const userName = ctx.member.full_name;
  const { t } = await getI18n();
  const items = [
    { href: "/boss", exact: true, label: t("nav.tasks"), icon: IconTasks },
    { href: "/boss/calendar", label: t("nav.calendar"), icon: IconCalendar },
    { href: "/boss/employees", label: t("nav.employees"), icon: IconUsers },
    { href: "/boss/money", label: t("nav.money"), icon: IconEuro },
    { href: "/boss/templates", label: t("nav.templates"), icon: IconRepeat },
    { href: "/boss/reports", label: t("nav.reports"), icon: IconChart },
    { href: "/boss/settings", label: t("nav.settings"), icon: IconSettings },
  ];
  const secondary = [
    { href: "/boss/requests", label: t("nav.requests"), icon: IconInbox, badge: pendingRequests },
    { href: "/boss/archive", label: t("nav.archive"), icon: IconArchive, badge: 0 },
  ];

  return (
    <div className="min-h-dvh lg:flex lg:gap-4 lg:p-4">
      {/* Seitenleiste (PC) */}
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col rounded-[18px] bg-surface px-2.5 py-4 lg:flex">
        <Link href="/boss" className="mb-6 flex items-center gap-2.5 px-2">
          <img src="/icons/icon.svg" alt="" className="size-8 rounded-[9px]" />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{firmName}</div>
            <div className="text-xs text-muted">{APP_NAME}</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact} variant="side">
              <i.icon className="size-5" />
              {i.label}
            </NavLink>
          ))}
          <div className="my-3 border-t border-line/70" />
          {secondary.map((i) => (
            <NavLink key={i.href} href={i.href} variant="side">
              <i.icon className="size-5" />
              <span className="flex-1">{i.label}</span>
              {i.badge > 0 && <span className="chip bg-accent text-white">{i.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <TrialCard firm={ctx.firm} className="mx-1 mt-auto" />
        <div className="mt-3 flex items-center gap-2 px-2">
          <Avatar name={userName} />
          <span className="flex-1 truncate text-sm">{userName}</span>
        </div>
        <LogoutButton className="mt-2 !min-h-9 justify-start text-sm" />
      </aside>

      <div className="min-w-0 flex-1">
        <DemoFirmBar ctx={ctx} />
        <OfflineBanner />
        {/* Kopfzeile (Handy) */}
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between bg-bg/90 px-4 py-2 backdrop-blur lg:hidden">
          <span className="truncate font-semibold">{firmName}</span>
          <Link href="/boss/requests" className="btn-ghost relative !px-3" aria-label={t("nav.requests")}>
            <IconInbox />
            {pendingRequests > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-danger" />}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-4 lg:px-0 lg:pb-4 lg:pt-0">
          <ExpiredBanner firm={ctx.firm} isBoss />
          {children}
        </main>
      </div>

      {/* Untere Navigation (Handy) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <NavLink href="/boss" exact variant="bottom"><IconTasks />{t("nav.tasks")}</NavLink>
        <NavLink href="/boss/calendar" variant="bottom"><IconCalendar />{t("nav.calendar")}</NavLink>
        <NavLink href="/boss/employees" variant="bottom"><IconUsers />{t("nav.employees")}</NavLink>
        <NavLink href="/boss/money" variant="bottom"><IconEuro />{t("nav.money")}</NavLink>
        <NavLink href="/boss/more" variant="bottom"><IconMenu />{t("nav.more")}</NavLink>
      </nav>
    </div>
  );
}
