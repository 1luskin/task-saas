import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { trialInfo } from "@/lib/trial";
import type { Firm } from "@/lib/supabase/types";
import { cx } from "../ui";

export const CONTACT_MAILTO = "mailto:kontakt@example.de"; // Platzhalter – in LAUNCH_CHECKLIST.md

/** Karte unten im Menü: Testzeitraum mit Fortschrittsbalken */
export async function TrialCard({ firm, className }: { firm: Firm; className?: string }) {
  if (firm.is_demo || firm.plan === "paid") return null;
  const { t } = await getI18n();
  const i = trialInfo(firm);
  return (
    <div className={cx("rounded-[14px] bg-card p-3 text-sm", className)}>
      <div className="font-semibold">{i.expired ? t("trial.expiredTitle") : t("trial.title")}</div>
      {!i.expired && (
        <div className={cx("mt-1", i.endingSoon ? "text-review" : "text-muted")}>
          {i.daysLeft === 0 ? t("trial.endsToday") : t("trial.daysLeft", { n: i.daysLeft, total: i.totalDays })}
        </div>
      )}
      <div className="mt-2.5 h-1.5 rounded-full bg-surface-3" role="progressbar" aria-label={t("trial.title")} aria-valuemin={0} aria-valuemax={i.totalDays} aria-valuenow={i.totalDays - i.daysLeft}>
        <div className={cx("h-1.5 rounded-full", i.expired ? "bg-danger" : "bg-accent-2")} style={{ width: `${Math.round(i.progress * 100)}%` }} />
      </div>
      <Link href="/boss/plans" className="mt-2.5 inline-block font-semibold text-link">{t("trial.plans")}</Link>
    </div>
  );
}

/** Hinweis nach Ablauf: alles lesbar/exportierbar, Anlegen gesperrt */
export async function ExpiredBanner({ firm, isBoss }: { firm: Firm; isBoss: boolean }) {
  const i = trialInfo(firm);
  if (!i.expired && !i.blocked) return null;
  const { t } = await getI18n();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] bg-danger-soft p-4 text-danger">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{i.blocked ? t("trial.blockedTitle") : t("trial.expiredTitle")}</div>
        <div className="text-sm text-ink-2">{i.blocked ? t("trial.blockedText") : t("trial.expiredText")}</div>
      </div>
      <a href={CONTACT_MAILTO} className="btn-secondary">{t("trial.contact")}</a>
      {isBoss && <Link href="/boss/plans" className="btn-primary">{t("trial.plans")}</Link>}
    </div>
  );
}
