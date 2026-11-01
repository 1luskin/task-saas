import { getI18n } from "@/i18n/server";
import { NavLink } from "./nav-link";
import { OfflineBanner } from "./offline-banner";
import { IconSun, IconTasks, IconUser, IconWallet } from "../icons";

export async function StaffShell({ firmName, children }: { firmName: string; children: React.ReactNode }) {
  const { t } = await getI18n();
  const tabs = [
    { href: "/staff/today", label: t("nav.today"), icon: IconSun },
    { href: "/staff/tasks", label: t("nav.tasks"), icon: IconTasks },
    { href: "/staff/earnings", label: t("nav.earnings"), icon: IconWallet },
    { href: "/staff/profile", label: t("nav.profile"), icon: IconUser },
  ];
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <img src="/icons/icon.svg" alt="" className="size-8 rounded-[9px]" />
          <span className="flex-1 truncate font-semibold">{firmName}</span>
          <nav className="hidden gap-1 lg:flex">
            {tabs.map((tab) => (
              <NavLink key={tab.href} href={tab.href} variant="side">
                <tab.icon className="size-5" />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 lg:pb-10">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        {tabs.map((tab) => (
          <NavLink key={tab.href} href={tab.href} variant="bottom">
            <tab.icon className="size-7" />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
