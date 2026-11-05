import { requireStaffPage } from "@/lib/auth";
import Link from "next/link";
import { IconSun } from "@/components/icons";
import { getI18n } from "@/i18n/server";
import { isOverdue, todayISO, weekPeriod, formatDate } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { staffTaskExtras } from "@/server/staff";
import { StaffTaskCard } from "@/components/tasks/staff-task-card";
import { ShiftCard } from "@/components/shifts/shift-card";
import { GeoConsent } from "@/components/geo/geo-consent";
import { isEnabled } from "@/lib/features";
import { EmptyState } from "@/components/ui";

export default async function TodayPage() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const today = todayISO();
  const shiftsOn = await isEnabled(ctx, "shifts");
  const [{ data }, fin, { data: openShift }] = await Promise.all([
    // RLS: nur eigene Aufgaben
    ctx.supabase
      .from("tasks")
      .select("*")
      .eq("assignee_id", ctx.member.id)
      .or(`due_date.eq.${today},and(status.neq.done,status.neq.review,due_date.lt.${today}),status.eq.in_progress,status.eq.rework`)
      .order("due_time", { nullsFirst: false }),
    loadFinance(ctx, weekPeriod(today), { memberId: ctx.member.id }),
    ctx.supabase.from("shifts").select("*").eq("member_id", ctx.member.id).is("ended_at", null).maybeSingle(),
  ]);
  const tasks = (data ?? []).sort((a, b) => {
    const rank = (x: typeof a) => (x.status === "done" || x.status === "review" ? 3 : x.status === "rework" || isOverdue(x) ? 0 : x.priority === "urgent" ? 1 : 2);
    return rank(a) - rank(b);
  });
  // "erledigt" aus Sicht des Mitarbeiters: abgegeben oder abgenommen
  const done = tasks.filter((x) => x.status === "done" || x.status === "review").length;
  const extras = await staffTaskExtras(ctx, tasks);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const week = fin.perMember.get(ctx.member.id)?.totalCents ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-muted">{formatDate(today, locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("staff.hello", { name: ctx.member.full_name.split(" ")[0] ?? "" })}</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/staff/route" className="btn-secondary">{t("geo.route")}</Link>
        <Link href="/staff/scan" className="btn-secondary">{t("qr.scan")}</Link>
      </div>
      <GeoConsent />
      {shiftsOn && (
        <ShiftCard
          open={openShift ?? null}
          geofence={ctx.firm.geofence_radius_m ? { radius: ctx.firm.geofence_radius_m, targets: tasks.filter((x) => x.due_date === today && x.status !== "done").map((x) => ({ lat: x.lat, lng: x.lng })) } : null}
        />
      )}

      {ctx.member.status !== "active" && (
        <div className="card bg-danger-soft p-4 text-danger">{t(`memberStatus.${ctx.member.status}`)}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card-white p-4">
          <div className="text-lg font-semibold">{t("staff.progress", { done, total: tasks.length })}</div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="card-white p-4">
          <div className="text-sm text-muted">{t("staff.weekEarnings")}</div>
          <div className="mt-1 text-2xl font-semibold text-link">{formatMoney(week, locale)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 && (
          <EmptyState icon={<IconSun />} action={<Link href="/staff/tasks" className="btn-secondary">{t("staff.allTasks")}</Link>}>
            {t("staff.noTasksToday")}
          </EmptyState>
        )}
        {tasks.map((task) => (
          <StaffTaskCard
            key={task.id}
            task={task}
            t={t}
            locale={locale}
            runningSince={extras.running.get(task.id) ?? null}
            spentMinutes={extras.spent.get(task.id) ?? 0}
            checklist={extras.progress.get(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
