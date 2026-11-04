import type { Ctx } from "@/lib/auth";
import type { TFunction } from "@/i18n/config";
import { formatDateTime, formatDuration, minutesBetween, monthPeriod, periodToRange, todayISO } from "@/lib/dates";
import { shiftNetMinutes } from "@/lib/shifts";
import { TimeEditor } from "./time-editor";

/** Arbeitszeiten eines Mitarbeiters im laufenden Monat + Änderungsverlauf (Arbeitszeiterfassung) */
export async function TimesView({ ctx, memberId, t, locale, editable }: { ctx: Ctx; memberId: string; t: TFunction; locale: string; editable: boolean }) {
  const { fromTs, toTs } = periodToRange(monthPeriod(todayISO()));
  const [{ data: shifts }, { data: entries }, { data: edits }, { data: names }] = await Promise.all([
    ctx.supabase.from("shifts").select("*").eq("member_id", memberId).gte("started_at", fromTs).lt("started_at", toTs).order("started_at", { ascending: false }),
    ctx.supabase.from("time_entries").select("*").eq("member_id", memberId).gte("started_at", fromTs).lt("started_at", toTs).order("started_at", { ascending: false }),
    ctx.supabase.from("time_edits").select("*").eq("member_id", memberId).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("members").select("id, full_name").eq("firm_id", ctx.firm.id),
  ]);
  const taskIds = [...new Set((entries ?? []).map((e) => e.task_id))];
  const { data: tasks } = taskIds.length ? await ctx.supabase.from("tasks").select("id, title").in("id", taskIds) : { data: [] as { id: string; title: string }[] };
  const who = (id: string | null) => names?.find((n) => n.id === id)?.full_name ?? "—";
  const span = (a: string, b: string | null) => `${formatDateTime(a, locale)} – ${b ? formatDateTime(b, locale) : t("times.open")}`;

  return (
    <div className="space-y-4">
      <section className="card-white space-y-2 p-4">
        <h2 className="font-semibold">{t("times.shifts")}</h2>
        {(shifts ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 tabular-nums">{span(s.started_at, s.ended_at)}</span>
            {s.break_minutes > 0 && <span className="text-muted">{t("shift.pause")}: {s.break_minutes} min</span>}
            <span className="font-semibold tabular-nums">{formatDuration(shiftNetMinutes(s))}</span>
            {s.needs_review && <span className="chip bg-review-soft text-review">{t("shift.autoClosed")}</span>}
            {editable && <TimeEditor kind="shift" id={s.id} startedAt={s.started_at} endedAt={s.ended_at} breakMinutes={s.break_minutes} />}
          </div>
        ))}
        {!shifts?.length && <p className="text-sm text-muted">—</p>}
      </section>
      <section className="card-white space-y-2 p-4">
        <h2 className="font-semibold">{t("times.entries")}</h2>
        {(entries ?? []).map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
            <span className="min-w-0 flex-1"><span className="font-medium">{tasks?.find((x) => x.id === e.task_id)?.title ?? "—"}</span> <span className="tabular-nums text-muted">{span(e.started_at, e.ended_at)}</span></span>
            <span className="font-semibold tabular-nums">{formatDuration(minutesBetween(e.started_at, e.ended_at))}</span>
            {editable && <TimeEditor kind="time_entry" id={e.id} startedAt={e.started_at} endedAt={e.ended_at} breakMinutes={0} />}
          </div>
        ))}
        {!entries?.length && <p className="text-sm text-muted">—</p>}
      </section>
      <section className="card-white space-y-2 p-4">
        <h2 className="font-semibold">{t("times.history")}</h2>
        {(edits ?? []).map((h) => (
          <div key={h.id} className="rounded-[12px] bg-card px-3 py-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{h.reason}</span><span className="text-muted">{formatDateTime(h.created_at, locale)} · {t("times.by", { name: who(h.changed_by) })}</span></div>
            <div className="mt-1 text-xs text-muted tabular-nums">
              {t("times.before")}: {span(String(h.before.started_at), (h.before.ended_at as string | null) ?? null)} → {t("times.after")}: {span(String(h.after.started_at), (h.after.ended_at as string | null) ?? null)}
            </div>
          </div>
        ))}
        {!edits?.length && <p className="text-sm text-muted">—</p>}
      </section>
    </div>
  );
}
