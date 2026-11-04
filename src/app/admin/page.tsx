import Link from "next/link";
import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { trialInfo } from "@/lib/trial";
import { Stat, cx } from "@/components/ui";
import { FirmActions } from "@/components/admin/firm-actions";

type Overview = { created_at: string; last_activity: string; plan: "trial" | "paid" | "expired" | "blocked"; trial_ends_at: string; is_demo: boolean };

/** Kennzahlen für die Übersicht (außerhalb des Renderns, da zeitabhängig) */
function adminStats(firms: Overview[], now = Date.now()) {
  const D = 864e5;
  const ago = (iso: string) => now - new Date(iso).getTime();
  return {
    total: firms.length,
    active7: firms.filter((f) => ago(f.last_activity) <= 7 * D).length,
    active30: firms.filter((f) => ago(f.last_activity) <= 30 * D).length,
    new7: firms.filter((f) => ago(f.created_at) <= 7 * D).length,
    new30: firms.filter((f) => ago(f.created_at) <= 30 * D).length,
    ending: firms.filter((f) => {
      const i = trialInfo(f, now);
      return f.plan === "trial" && !i.expired && i.daysLeft <= 3;
    }).length,
  };
}

export default async function AdminHome() {
  const { admin } = await requireSuperadmin();
  const { t, locale } = await getI18n();
  const { data } = await admin.rpc("admin_firm_overview");
  const firms = data ?? [];
  const stats = adminStats(firms);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("admin.statFirms")} value={stats.total} />
        <Stat label={t("admin.statActive7")} value={stats.active7} />
        <Stat label={t("admin.statActive30")} value={stats.active30} />
        <Stat label={t("admin.statNew7")} value={stats.new7} />
        <Stat label={t("admin.statNew30")} value={stats.new30} />
        <Stat label={t("admin.statEnding")} value={stats.ending} tone={stats.ending ? "review" : undefined} />
      </div>
      <div className="card-white overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-card text-left text-muted">
            <tr>
              {[t("admin.colFirm"), t("admin.colOwner"), t("admin.colPlan"), t("admin.colTrial"), t("admin.colMembers"), t("admin.colTasks"), t("admin.colActivity"), ""].map((h, i) => (
                <th key={i} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {firms.map((f) => {
              const i = trialInfo(f);
              return (
                <tr key={f.id}>
                  <td className="px-3 py-2"><Link className="font-medium text-link" href={`/admin/firms/${f.id}`}>{f.name}</Link>{f.deletion_scheduled_for && <div className="text-xs text-danger">{t("admin.deletionAt")} {formatDate(f.deletion_scheduled_for.slice(0, 10), locale)}</div>}</td>
                  <td className="px-3 py-2 text-ink-2">{f.owner_email ?? "—"}</td>
                  <td className="px-3 py-2"><span className={cx("chip", f.plan === "blocked" || i.expired ? "bg-danger-soft text-danger" : f.plan === "paid" ? "bg-ok-soft text-ok" : "bg-surface-3 text-ink-2")}>{f.plan}{f.plan === "trial" && i.expired ? " · expired" : ""}</span></td>
                  <td className="px-3 py-2 tabular-nums">{formatDate(f.trial_ends_at.slice(0, 10), locale)}</td>
                  <td className="px-3 py-2 tabular-nums">{f.members}</td>
                  <td className="px-3 py-2 tabular-nums">{f.tasks}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDate(f.last_activity.slice(0, 10), locale)}</td>
                  <td className="px-3 py-2"><FirmActions firmId={f.id} plan={f.plan} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
