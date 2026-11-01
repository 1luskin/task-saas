import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isOverdue, todayISO, weekPeriod, formatDate } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { staffTaskExtras } from "@/server/staff";
import { StaffTaskCard } from "@/components/tasks/staff-task-card";
import { EmptyState } from "@/components/ui";

export default async function TodayPage() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const today = todayISO();
  const [{ data }, fin] = await Promise.all([
    // RLS: nur eigene Aufgaben
    ctx.supabase
      .from("tasks")
      .select("*")
      .eq("assignee_id", ctx.member.id)
      .or(`due_date.eq.${today},and(status.neq.done,due_date.lt.${today}),status.eq.in_progress`)
      .order("due_time", { nullsFirst: false }),
    loadFinance(ctx, weekPeriod(today), { memberId: ctx.member.id }),
  ]);
  const tasks = (data ?? []).sort((a, b) => {
    const rank = (x: typeof a) => (x.status === "done" ? 3 : isOverdue(x) ? 0 : x.priority === "urgent" ? 1 : 2);
    return rank(a) - rank(b);
  });
  const done = tasks.filter((x) => x.status === "done").length;
  const extras = await staffTaskExtras(ctx, tasks);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const week = fin.perMember.get(ctx.member.id)?.totalCents ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-muted">{formatDate(today, locale, { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("staff.hello", { name: ctx.member.full_name.split(" ")[0] ?? "" })}</h1>
      </div>

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
          <div className="mt-1 text-2xl font-semibold text-accent">{formatMoney(week, locale)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 && <EmptyState>{t("staff.noTasksToday")}</EmptyState>}
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
