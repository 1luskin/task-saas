import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { addDays, formatDate, formatDateTime, startOfWeek, todayISO } from "@/lib/dates";
import { remainingVacation } from "@/lib/vacation";
import { cx, EmptyState, PageTitle } from "@/components/ui";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@/components/icons";
import {
  AnnouncementForm, DeleteButton, DeletePlan, DocumentForm, PlanForm, SwapDecide, VacationDays, VacationDecide,
} from "@/components/team/boss-team";

const TABS = ["plan", "vacation", "board", "reports", "docs"] as const;
type Tab = (typeof TABS)[number];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "plan";
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "team"))) notFound();
  const { t, locale } = await getI18n();
  const today = todayISO();
  const week = startOfWeek(sp.week && ISO.test(sp.week) ? sp.week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const d0 = week, d6 = addDays(week, 6);
  const year = Number(today.slice(0, 4));

  const { data: membersRaw } = await ctx.supabase.from("members").select("*").eq("firm_id", ctx.firm.id).is("archived_at", null).order("full_name");
  const members = membersRaw ?? [];
  const name = new Map(members.map((m) => [m.id, m.full_name]));
  const staff = members.filter((m) => m.role === "employee");
  const opts = (staff.length ? staff : members).map((m) => ({ id: m.id, name: m.full_name }));

  const tabs = (
    <nav className="mb-4 flex flex-wrap gap-1 rounded-[12px] bg-surface p-1" aria-label={t("team.title")}>
      {TABS.map((k) => (
        <Link key={k} href={`/boss/team?tab=${k}`} aria-current={tab === k ? "page" : undefined}
          className={cx("min-h-10 rounded-[9px] px-3 py-2 text-sm", tab === k ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")}>
          {{ plan: t("team.plan"), vacation: t("team.vacations"), board: t("team.board"), reports: t("team.reports"), docs: t("team.documents") }[k]}
        </Link>
      ))}
    </nav>
  );

  let body: React.ReactNode = null;

  if (tab === "plan") {
    const [{ data: plans }, { data: swaps }, { data: vac }] = await Promise.all([
      ctx.supabase.from("shift_plans").select("*").eq("firm_id", ctx.firm.id).gte("date", d0).lte("date", d6).order("start_time"),
      ctx.supabase.from("shift_swaps").select("*").eq("firm_id", ctx.firm.id).in("status", ["pending", "accepted"]).order("created_at"),
      ctx.supabase.from("vacation_requests").select("*").eq("firm_id", ctx.firm.id).eq("status", "approved").lte("date_from", d6).gte("date_to", d0),
    ]);
    const { data: swapPlans } = swaps?.length ? await ctx.supabase.from("shift_plans").select("*").in("id", swaps.map((s) => s.plan_id)) : { data: [] };
    const planById = new Map((swapPlans ?? []).map((p) => [p.id, p]));
    body = (
      <div className="space-y-4">
        <section className="card-white p-4"><PlanForm members={opts} defaultDate={d0 < today ? today : d0} /></section>
        <section className="card-white overflow-x-auto p-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <Link className="btn-ghost !px-2" href={`/boss/team?tab=plan&week=${addDays(week, -7)}`} aria-label="-1"><IconChevronLeft /></Link>
            <span className="text-sm text-muted">{t("team.week")} {formatDate(d0, locale)} – {formatDate(d6, locale)}</span>
            <Link className="btn-ghost !px-2" href={`/boss/team?tab=plan&week=${addDays(week, 7)}`} aria-label="+1"><IconChevronRight /></Link>
          </div>
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-40 text-left font-normal text-muted">{t("team.member")}</th>
                {days.map((d) => (
                  <th key={d} className={cx("font-normal", d === today ? "text-link" : "text-muted")}>{formatDate(d, locale, { weekday: "short", day: "2-digit", month: "2-digit" })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opts.map((m) => (
                <tr key={m.id}>
                  <td className="truncate py-1 pr-2">{m.name}</td>
                  {days.map((d) => {
                    const off = (vac ?? []).some((v) => v.member_id === m.id && v.date_from <= d && v.date_to >= d);
                    return (
                      <td key={d} className={cx("h-12 rounded-[8px] align-top", off ? "hatch bg-surface-2" : "bg-card")} title={off ? t("team.vacations") : undefined}>
                        <div className="space-y-1 p-1">
                          {(plans ?? []).filter((p) => p.member_id === m.id && p.date === d).map((p) => (
                            <DeletePlan key={p.id} id={p.id} label={`${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)}`} />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card-white space-y-2 p-4">
          <h2 className="font-semibold">{t("team.swaps")}</h2>
          {(swaps ?? []).map((s) => {
            const p = planById.get(s.plan_id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-[12px] bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div>{name.get(s.from_member)} → {name.get(s.to_member)}</div>
                  {p && <div className="text-sm text-muted tabular-nums">{formatDate(p.date, locale)} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</div>}
                </div>
                <span className={cx("chip", s.status === "accepted" ? "bg-review-soft text-review" : "bg-surface-3 text-ink-2")}>{t(`team.st_${s.status}`)}</span>
                {s.status === "accepted" && <SwapDecide id={s.id} />}
              </div>
            );
          })}
          {!swaps?.length && <p className="text-sm text-muted">{t("team.noItems")}</p>}
        </section>
      </div>
    );
  }

  if (tab === "vacation") {
    const { data: reqs } = await ctx.supabase.from("vacation_requests").select("*").eq("firm_id", ctx.firm.id).order("date_from", { ascending: false }).limit(200);
    const all = reqs ?? [];
    body = (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card-white divide-y divide-line/60">
          {all.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{name.get(r.member_id)}</div>
                <div className="text-sm text-muted tabular-nums">{formatDate(r.date_from, locale)} – {formatDate(r.date_to, locale)} · {t("team.days", { n: r.days })}{r.note ? ` · ${r.note}` : ""}</div>
              </div>
              <span className={cx("chip", r.status === "approved" ? "bg-ok-soft text-ok" : r.status === "rejected" ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{t(`team.${r.status}`)}</span>
              {r.status === "pending" && <VacationDecide id={r.id} />}
            </div>
          ))}
          {!all.length && <EmptyState icon={<IconCalendar />}>{t("team.noItems")}</EmptyState>}
        </section>
        <section className="card-white space-y-3 p-4">
          <h2 className="font-semibold">{t("team.perYear")}</h2>
          {opts.map((m) => {
            const total = members.find((x) => x.id === m.id)?.vacation_days_per_year ?? 0;
            const rest = remainingVacation(total, all.filter((r) => r.member_id === m.id), year);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{m.name}</div>
                  <div className={cx("text-xs tabular-nums", rest < 0 ? "text-danger" : "text-muted")}>{t("team.remaining", { n: rest, total })}</div>
                </div>
                <VacationDays memberId={m.id} value={total} />
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  if (tab === "board") {
    const [{ data: anns }, { data: groups }] = await Promise.all([
      ctx.supabase.from("announcements").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(50),
      ctx.supabase.from("groups").select("*").eq("firm_id", ctx.firm.id).order("name"),
    ]);
    const { data: reads } = anns?.length ? await ctx.supabase.from("announcement_reads").select("*").in("announcement_id", anns.map((a) => a.id)) : { data: [] };
    body = (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          {(anns ?? []).map((a) => {
            const r = (reads ?? []).filter((x) => x.announcement_id === a.id);
            const audience = members.filter((m) => m.role === "employee" && (!a.group_id || m.group_id === a.group_id));
            return (
              <article key={a.id} className="card-white space-y-2 p-4">
                <div className="flex items-start gap-2">
                  <h2 className="flex-1 font-semibold">{a.title}</h2>
                  <DeleteButton id={a.id} kind="announcement" />
                </div>
                <p className="whitespace-pre-wrap text-ink-2">{a.body}</p>
                <div className="text-xs text-muted">
                  {formatDateTime(a.created_at, locale)} · {a.group_id ? groups?.find((g) => g.id === a.group_id)?.name : t("team.allGroups")} · {t("team.readBy", { n: `${r.length}/${audience.length}` })}
                </div>
                {r.length > 0 && <div className="text-xs text-muted">{t("team.reads")}: {r.map((x) => name.get(x.member_id)).filter(Boolean).join(", ")}</div>}
              </article>
            );
          })}
          {!anns?.length && <div className="card-white"><EmptyState>{t("team.noItems")}</EmptyState></div>}
        </section>
        <section className="card-white space-y-3 p-4">
          <h2 className="font-semibold">{t("team.board")}</h2>
          <AnnouncementForm groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))} />
        </section>
      </div>
    );
  }

  if (tab === "reports") {
    const { data: reps } = await ctx.supabase.from("daily_reports").select("*").eq("firm_id", ctx.firm.id).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    const paths = (reps ?? []).flatMap((r) => r.photo_paths);
    const { data: signed } = paths.length ? await ctx.supabase.storage.from("report-photos").createSignedUrls(paths, 15 * 60) : { data: [] };
    const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const taskIds = [...new Set((reps ?? []).map((r) => r.task_id).filter((x): x is string => !!x))];
    const { data: tasks } = taskIds.length ? await ctx.supabase.from("tasks").select("id,title").in("id", taskIds) : { data: [] };
    body = (
      <section className="card-white divide-y divide-line/60">
        {(reps ?? []).map((r) => (
          <article key={r.id} className="space-y-1 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{name.get(r.member_id)}</span>
              <span className="text-sm text-muted">{formatDate(r.date, locale)}</span>
              {r.task_id && <Link className="text-sm text-link" href={`/boss/tasks/${r.task_id}`}>{tasks?.find((x) => x.id === r.task_id)?.title}</Link>}
            </div>
            <p className="whitespace-pre-wrap">{r.done_text}</p>
            {r.problems && <p className="whitespace-pre-wrap text-danger">{r.problems}</p>}
            {r.photo_paths.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {r.photo_paths.map((p) => url.get(p) ? (
                  <a key={p} href={url.get(p)!} target="_blank" rel="noreferrer"><img src={url.get(p)!} alt="" className="size-20 rounded-[10px] object-cover" /></a>
                ) : <span key={p} className="chip bg-surface-3 text-ink-2">{t("team.photos")}</span>)}
              </div>
            )}
          </article>
        ))}
        {!reps?.length && <EmptyState>{t("team.noItems")}</EmptyState>}
      </section>
    );
  }

  if (tab === "docs") {
    const { data: docs } = await ctx.supabase.from("member_documents").select("*").eq("firm_id", ctx.firm.id).order("expires_on", { nullsFirst: false });
    const fp = (docs ?? []).map((d) => d.file_path).filter((x): x is string => !!x);
    const { data: signed } = fp.length ? await ctx.supabase.storage.from("member-docs").createSignedUrls(fp, 15 * 60) : { data: [] };
    const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const soon = addDays(today, 30);
    body = (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card-white divide-y divide-line/60">
          {(docs ?? []).map((d) => {
            const expired = !!d.expires_on && d.expires_on < today;
            const warn = !expired && !!d.expires_on && d.expires_on <= soon;
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.file_path && url.get(d.file_path) ? <a className="text-link" href={url.get(d.file_path)!} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</div>
                  <div className="text-sm text-muted">{name.get(d.member_id)}{d.expires_on ? ` · ${t("team.expires")} ${formatDate(d.expires_on, locale)}` : ""}</div>
                </div>
                {(expired || warn) && <span className={cx("chip", expired ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{expired ? t("team.expired") : t("team.expiresSoon")}</span>}
                <DeleteButton id={d.id} kind="document" />
              </div>
            );
          })}
          {!docs?.length && <EmptyState>{t("team.noItems")}</EmptyState>}
        </section>
        <section className="card-white space-y-3 p-4">
          <h2 className="font-semibold">{t("team.documents")}</h2>
          <DocumentForm members={opts} firmId={ctx.firm.id} />
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageTitle actions={<Link className="btn-secondary" href="/boss/employees/import">{t("team.import")}</Link>}>{t("team.title")}</PageTitle>
      {tabs}
      {body}
    </div>
  );
}
