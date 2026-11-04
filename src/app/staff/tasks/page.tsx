import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { addDays, formatDate, isOverdue, todayISO } from "@/lib/dates";
import { EmptyState, cx, STATUS_DOT } from "@/components/ui";
import { TaskRow } from "@/components/tasks/task-row";

export default async function StaffTasksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireStaffPage();
  const { t, locale, messages } = await getI18n();
  const { tab } = await searchParams;
  const today = todayISO();
  const showDone = tab === "done";

  const { data } = await (showDone
    ? ctx.supabase.from("tasks").select("*").eq("assignee_id", ctx.member.id).eq("status", "done").order("completed_at", { ascending: false }).limit(50)
    : ctx.supabase.from("tasks").select("*").eq("assignee_id", ctx.member.id).neq("status", "done").order("due_date", { nullsFirst: false }));
  const tasks = data ?? [];

  // Woche voraus
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const { data: upcoming } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("assignee_id", ctx.member.id)
    .gte("due_date", today)
    .lt("due_date", addDays(today, 7));
  const byDay = new Map<string, NonNullable<typeof upcoming>>();
  for (const x of upcoming ?? []) byDay.set(x.due_date!, [...(byDay.get(x.due_date!) ?? []), x]);

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-semibold">{t("staff.upcoming")}</h2>
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const wd = messages.weekdaysShort[((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7)];
            return (
              <div key={d} className={cx("card-white w-[136px] shrink-0 snap-start p-3", d === today && "border-accent")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">{wd}</span>
                  <span className={cx("text-lg font-semibold", d === today && "text-link")}>{Number(d.slice(8))}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {list.length === 0 && <li className="text-sm text-muted/70">—</li>}
                  {list.map((x) => (
                    <li key={x.id}>
                      <Link href={`/staff/tasks/${x.id}`} className="flex items-center gap-1.5 text-sm">
                        <span className={cx("size-2 shrink-0 rounded-full", isOverdue(x) ? "bg-danger" : STATUS_DOT[x.status])} />
                        <span className={cx("truncate", x.priority === "urgent" && "font-semibold text-danger")}>{x.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-[14px] bg-card p-1">
          <Link href="/staff/tasks" className={cx("btn !min-h-11", !showDone ? "bg-surface-3 text-ink" : "text-muted")}>{t("staff.openTasks")}</Link>
          <Link href="/staff/tasks?tab=done" className={cx("btn !min-h-11", showDone ? "bg-surface-3 text-ink" : "text-muted")}>{t("staff.doneTasks")}</Link>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 && <EmptyState>{t("dashboard.noTasks")}</EmptyState>}
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} href={`/staff/tasks/${task.id}`} assigneeName={null} t={t} locale={locale} showAssignee={false} />
          ))}
        </div>
      </section>
      <p className="text-center text-xs text-muted">{formatDate(today, locale)}</p>
    </div>
  );
}
