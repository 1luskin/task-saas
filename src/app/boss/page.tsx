import Link from "next/link";
import { Suspense } from "react";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isOverdue, todayISO, weekPeriod } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getCalendarTasks, getGroups, getMembers, parseCalParams, pendingRequestCount } from "@/server/queries";
import { Calendar } from "@/components/calendar/calendar";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/demo/mode";
import { Hint } from "@/components/hint";
import { TaskFilters } from "@/components/tasks/filters";
import { TaskRow } from "@/components/tasks/task-row";
import { EmptyState, Stat } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import type { Task } from "@/lib/supabase/types";
import { IconChevronRight, IconTasks } from "@/components/icons";

type SP = { status?: string; member?: string; priority?: string; group?: string; cal?: string; view?: string };

export default async function BossDashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  if (!ctx.settings.onboarding_done && !ctx.firm.is_demo && !isDemo()) redirect("/boss/welcome");
  const [members, groups, pending] = await Promise.all([getMembers(ctx, { includeArchived: true }), getGroups(ctx), pendingRequestCount(ctx)]);
  const nameOf = (id: string | null) => (id ? members.find((m) => m.id === id)?.full_name ?? null : null);

  // Aufgabenliste mit Filtern
  let q = ctx.supabase.from("tasks").select("*").eq("firm_id", ctx.firm.id);
  const status = sp.status ?? "";
  if (status === "" || status === "overdue") q = q.neq("status", "done");
  else if (status === "new" || status === "in_progress" || status === "review" || status === "rework" || status === "done") q = q.eq("status", status);
  if (sp.member === "none") q = q.is("assignee_id", null);
  else if (sp.member && /^[0-9a-f-]{36}$/.test(sp.member)) q = q.eq("assignee_id", sp.member);
  if (sp.priority === "urgent" || sp.priority === "normal") q = q.eq("priority", sp.priority);
  if (sp.group && /^[0-9a-f-]{36}$/.test(sp.group)) {
    const ids = members.filter((m) => m.group_id === sp.group).map((m) => m.id);
    q = q.in("assignee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  q = status === "done" ? q.order("completed_at", { ascending: false }).limit(100) : q.order("due_date", { ascending: true, nullsFirst: false }).limit(300);

  const { anchor, view } = parseCalParams(sp);
  const [{ data: listData }, { data: openData }, fin, calTasks] = await Promise.all([
    q,
    ctx.supabase.from("tasks").select("id, status, due_date, due_time").eq("firm_id", ctx.firm.id).neq("status", "done"),
    loadFinance(ctx, weekPeriod(todayISO())),
    getCalendarTasks(ctx, view, anchor, nameOf),
  ]);

  let tasks: Task[] = listData ?? [];
  if (status === "overdue") tasks = tasks.filter((x) => isOverdue(x));
  tasks.sort((a, b) => {
    if (status === "done") return 0;
    const rank = (x: Task) => (x.status === "review" ? 0 : isOverdue(x) ? 1 : 2);
    const ao = rank(a), bo = rank(b);
    if (ao !== bo) return ao - bo;
    const au = a.priority === "urgent" ? 0 : 1, bu = b.priority === "urgent" ? 0 : 1;
    if (au !== bu) return au - bu;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  const open = openData ?? [];
  const overdueCount = open.filter((x) => isOverdue(x)).length;
  const inProgress = open.filter((x) => x.status === "in_progress").length;
  const inReview = open.filter((x) => x.status === "review").length;

  const { data: items } = tasks.length
    ? await ctx.supabase.from("checklist_items").select("task_id, done").in("task_id", tasks.map((x) => x.id))
    : { data: [] };
  const progress = new Map<string, { done: number; total: number }>();
  for (const it of items ?? []) {
    const p = progress.get(it.task_id) ?? { done: 0, total: 0 };
    p.total++;
    if (it.done) p.done++;
    progress.set(it.task_id, p);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] 2xl:grid-cols-[minmax(0,1fr)_600px]">
      {/* Mitte */}
      <section className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <Stat label={t("dashboard.overdue")} value={overdueCount} tone={overdueCount ? "danger" : undefined} href="/boss?status=overdue" />
          <Stat label={t("dashboard.review")} value={inReview} tone={inReview ? "review" : undefined} href="/boss?status=review" />
          <Stat label={t("dashboard.inProgress")} value={inProgress} href="/boss?status=in_progress" />
          <Stat label={t("dashboard.weekProfit")} value={<span className="text-base sm:text-2xl xl:text-3xl">{formatMoney(fin.profitCents, locale)}</span>} tone="accent" href="/boss/money" />
        </div>

        <Hint id="dashboard" dismissed={ctx.settings.hints_dismissed}>{t("hints.dashboard")}</Hint>
        {pending > 0 && (
          <Link href="/boss/requests" className="card flex min-h-12 items-center justify-between px-4 py-2 text-link">
            <span className="font-medium">{t("dashboard.pendingRequests", { n: pending })}</span>
            <IconChevronRight className="size-5" />
          </Link>
        )}

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.tasks")}</h1>
          <Link href="/boss/tasks/new" className="btn-primary">
            <IconPlus className="size-5" />
            {t("dashboard.newTask")}
          </Link>
        </div>
        <Suspense>
          <TaskFilters members={members.filter((m) => !m.archived_at)} groups={groups} />
        </Suspense>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <EmptyState icon={<IconTasks />} action={<Link href="/boss/tasks/new" className="btn-primary">{t("dashboard.newTask")}</Link>}>{t("dashboard.noTasks")}</EmptyState>
          ) : (
            tasks.map((task) => (
              <TaskRow key={task.id} task={task} href={`/boss/tasks/${task.id}`} assigneeName={nameOf(task.assignee_id)} checklist={progress.get(task.id)} t={t} locale={locale} />
            ))
          )}
        </div>
      </section>

      {/* Rechts: Kalender – immer sichtbar */}
      <aside className="order-first hidden lg:block xl:order-none">
        <div className="xl:sticky xl:top-6">
          <Suspense>
            <Calendar tasks={calTasks} view={view} anchor={anchor} taskHref="/boss/tasks/" compact />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}
