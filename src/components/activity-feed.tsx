import Link from "next/link";
import type { Ctx } from "@/lib/auth";
import type { TFunction, MessageKey } from "@/i18n/config";
import { formatDateTime, berlinStartOfDay, addDays } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/** Ereignis-Feed für Chefs: wer hat was getan; Filter Mitarbeiter/Datum über Suchparameter */
export async function ActivityFeed({ ctx, t, locale, member, date, names }: { ctx: Ctx; t: TFunction; locale: string; member?: string; date?: string; names: Map<string, string> }) {
  let q = ctx.supabase.from("activity").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(25);
  if (member && /^[0-9a-f-]{36}$/.test(member)) q = q.eq("member_id", member);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) q = q.gte("created_at", berlinStartOfDay(date).toISOString()).lt("created_at", berlinStartOfDay(addDays(date, 1)).toISOString());
  const { data } = await q;
  const text = (a: NonNullable<typeof data>[number]) => {
    const p = a.payload as Record<string, string | number>;
    const name = (a.member_id && names.get(a.member_id)) || "—";
    const key = `views.ev_${a.kind}` as MessageKey;
    return t(key, {
      name,
      title: String(p.title ?? ""),
      to: p.to ? t(`status.${p.to}` as MessageKey) : "",
      amount: typeof p.amount_cents === "number" ? formatMoney(p.amount_cents, locale) : "",
      rating: String(p.rating ?? ""),
    });
  };
  return (
    <div className="card-white p-4">
      <form className="mb-3 flex flex-wrap items-center gap-2" action="/boss">
        <h2 className="mr-auto font-semibold">{t("views.feed")}</h2>
        <select name="feedMember" defaultValue={member ?? ""} className="input !min-h-9 !w-auto text-sm" aria-label={t("dashboard.filterEmployee")}>
          <option value="">{t("views.feedAll")}</option>
          {[...names.entries()].map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <input type="date" name="feedDate" defaultValue={date ?? ""} className="input !min-h-9 !w-auto text-sm" aria-label={t("adjust.date")} />
        <button className="btn-secondary !min-h-9 !px-3 text-sm">OK</button>
      </form>
      <ul className="space-y-1.5 text-sm">
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex gap-2 rounded-[10px] px-1 py-1">
            <span className="w-24 shrink-0 tabular-nums text-muted">{formatDateTime(a.created_at, locale)}</span>
            {a.task_id ? <Link href={`/boss/tasks/${a.task_id}`} className="min-w-0 flex-1 text-ink-2 hover:text-ink">{text(a)}</Link> : <span className="min-w-0 flex-1 text-ink-2">{text(a)}</span>}
          </li>
        ))}
        {!data?.length && <li className="text-muted">—</li>}
      </ul>
    </div>
  );
}
