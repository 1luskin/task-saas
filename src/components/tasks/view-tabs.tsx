import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { cx } from "../ui";

/** Umschalter Liste / Kanban / Kalender */
export async function ViewTabs({ active }: { active: "list" | "kanban" | "calendar" }) {
  const { t } = await getI18n();
  const tabs = [
    { k: "list", href: "/boss", label: t("views.list") },
    { k: "kanban", href: "/boss/kanban", label: t("views.kanban") },
    { k: "calendar", href: "/boss/calendar", label: t("views.calendar") },
  ] as const;
  return (
    <nav className="inline-flex rounded-[12px] bg-surface p-1" aria-label={t("views.list")}>
      {tabs.map((tab) => (
        <Link key={tab.k} href={tab.href} aria-current={active === tab.k ? "page" : undefined} className={cx("min-h-10 rounded-[9px] px-3 py-2 text-sm", active === tab.k ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
