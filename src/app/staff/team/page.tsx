import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { addDays, formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { remainingVacation } from "@/lib/vacation";
import { cx } from "@/components/ui";
import { DailyReportForm, DeleteVacation, MarkRead, SwapAnswer, SwapRequest, VacationForm } from "@/components/team/staff-team";

export default async function StaffTeamPage() {
  const ctx = await requireStaffPage();
  if (!(await isEnabled(ctx, "team"))) notFound();
  const { t, locale } = await getI18n();
  const today = todayISO();
  const me = ctx.member.id;
  const [{ data: plans }, { data: col }, { data: swaps }, { data: vac }, { data: anns }, { data: reads }, { data: docs }, { data: tasks }] = await Promise.all([
    ctx.supabase.from("shift_plans").select("*").eq("member_id", me).gte("date", today).lte("date", addDays(today, 21)).order("date").order("start_time"),
    ctx.supabase.rpc("colleagues"),
    ctx.supabase.from("shift_swaps").select("*").or(`from_member.eq.${me},to_member.eq.${me}`).order("created_at", { ascending: false }).limit(20),
    ctx.supabase.from("vacation_requests").select("*").eq("member_id", me).order("date_from", { ascending: false }).limit(50),
    ctx.supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(20),
    ctx.supabase.from("announcement_reads").select("*").eq("member_id", me),
    ctx.supabase.from("member_documents").select("*").eq("member_id", me).order("expires_on", { nullsFirst: false }),
    ctx.supabase.from("tasks").select("id,title").eq("assignee_id", me).neq("status", "done").order("due_date", { nullsFirst: false }).limit(30),
  ]);
  const colleagues = (col ?? []).filter((c) => c.id !== me).map((c) => ({ id: c.id, name: c.full_name }));
  const colName = new Map(colleagues.map((c) => [c.id, c.name]));
  // Pläne zu Tauschanfragen (auch fremde, wenn ich Empfänger bin) – RLS erlaubt Sicht auf Firmenplan
  const swapPlanIds = [...new Set((swaps ?? []).map((s) => s.plan_id))];
  const { data: swapPlans } = swapPlanIds.length ? await ctx.supabase.from("shift_plans").select("*").in("id", swapPlanIds) : { data: [] };
  const planById = new Map((swapPlans ?? []).map((p) => [p.id, p]));
  const openSwap = new Set((swaps ?? []).filter((s) => s.from_member === me && (s.status === "pending" || s.status === "accepted")).map((s) => s.plan_id));
  const readSet = new Set((reads ?? []).map((r) => r.announcement_id));
  const year = Number(today.slice(0, 4));
  const total = ctx.member.vacation_days_per_year;
  const rest = remainingVacation(total, vac ?? [], year);
  const soon = addDays(today, 30);

  const planLabel = (id: string) => {
    const p = planById.get(id);
    return p ? `${formatDate(p.date, locale, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)}` : "";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("team.title")}</h1>

      {(anns ?? []).filter((a) => !readSet.has(a.id)).length > 0 && (
        <section className="space-y-2">
          {(anns ?? []).filter((a) => !readSet.has(a.id)).map((a) => (
            <article key={a.id} className="card space-y-2 border border-accent/40 p-4">
              <h2 className="font-semibold">{a.title}</h2>
              <p className="whitespace-pre-wrap text-ink-2">{a.body}</p>
              <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">{formatDateTime(a.created_at, locale)}</span><MarkRead id={a.id} /></div>
            </article>
          ))}
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t("team.myPlan")}</h2>
        {(plans ?? []).map((p) => (
          <div key={p.id} className="space-y-2 rounded-[12px] bg-surface-3 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{formatDate(p.date, locale, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
              <span className="tabular-nums">{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</span>
            </div>
            {openSwap.has(p.id) ? <span className="chip bg-review-soft text-review">{t("team.swapRequested")}</span> : <SwapRequest planId={p.id} colleagues={colleagues} />}
          </div>
        ))}
        {!plans?.length && <p className="text-sm text-muted">{t("team.noPlans")}</p>}
        {(swaps ?? []).length > 0 && (
          <div className="space-y-2 border-t border-line/60 pt-3">
            <h3 className="text-sm font-medium text-muted">{t("team.swaps")}</h3>
            {(swaps ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{s.to_member === me ? `${colName.get(s.from_member) ?? "—"} → ${t("team.forMe")}` : `→ ${colName.get(s.to_member) ?? "—"}`} · {planLabel(s.plan_id)}</span>
                {s.to_member === me && s.status === "pending" ? <SwapAnswer id={s.id} /> : <span className="chip bg-surface-3 text-ink-2">{t(`team.st_${s.status}`)}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("team.vacations")}</h2>
          <span className={cx("text-sm tabular-nums", rest < 0 ? "text-danger" : "text-muted")}>{t("team.remaining", { n: rest, total })}</span>
        </div>
        <VacationForm today={today} />
        {(vac ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 tabular-nums">{formatDate(r.date_from, locale)} – {formatDate(r.date_to, locale)} · {t("team.days", { n: r.days })}</span>
            <span className={cx("chip", r.status === "approved" ? "bg-ok-soft text-ok" : r.status === "rejected" ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{t(`team.${r.status}`)}</span>
            {r.status === "pending" && <DeleteVacation id={r.id} />}
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t("team.newReport")}</h2>
        <DailyReportForm firmId={ctx.firm.id} memberId={me} today={today} tasks={(tasks ?? []).map((x) => ({ id: x.id, name: x.title }))} />
      </section>

      {(docs ?? []).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">{t("team.documents")}</h2>
          {(docs ?? []).map((d) => {
            const expired = !!d.expires_on && d.expires_on < today;
            const warn = !expired && !!d.expires_on && d.expires_on <= soon;
            return (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{d.name}{d.expires_on ? ` · ${t("team.expires")} ${formatDate(d.expires_on, locale)}` : ""}</span>
                {(expired || warn) && <span className={cx("chip", expired ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{expired ? t("team.expired") : t("team.expiresSoon")}</span>}
              </div>
            );
          })}
        </section>
      )}

      {(anns ?? []).filter((a) => readSet.has(a.id)).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">{t("team.board")}</h2>
          {(anns ?? []).filter((a) => readSet.has(a.id)).map((a) => (
            <details key={a.id} className="rounded-[12px] bg-surface-3 px-3 py-2">
              <summary className="cursor-pointer">{a.title} <span className="text-xs text-muted">· {formatDate(a.created_at.slice(0, 10), locale)}</span></summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{a.body}</p>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
