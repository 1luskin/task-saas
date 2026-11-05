import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cx, EmptyState, PageTitle } from "@/components/ui";
import { EditMaterial, MaterialForm, StockForm } from "@/components/materials/materials";

export default async function MaterialsPage() {
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "materials"))) notFound();
  const { t, locale } = await getI18n();
  const [{ data: mats }, { data: moves }, { data: members }] = await Promise.all([
    ctx.supabase.from("materials").select("*").eq("firm_id", ctx.firm.id).is("archived_at", null).order("name"),
    ctx.supabase.from("material_moves").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(30),
    ctx.supabase.from("members").select("id, full_name").eq("firm_id", ctx.firm.id),
  ]);
  const list = (mats ?? []).map((m) => ({ ...m, stock: Number(m.stock), min_stock: Number(m.min_stock) }));
  const nf = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE", { maximumFractionDigits: 3 });
  const value = list.reduce((s, m) => s + Math.max(0, m.stock) * m.unit_cost_cents, 0);
  const matName = (id: string) => (mats ?? []).find((m) => m.id === id)?.name ?? "—";
  return (
    <div className="space-y-4">
      <PageTitle>{t("mat.title")}</PageTitle>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card-white divide-y divide-line/60">
          <div className="flex justify-between px-4 py-3 text-sm text-muted"><span>{t("mat.value")}</span><span className="tabular-nums text-ink">{formatMoney(Math.round(value), locale)}</span></div>
          {list.map((m) => {
            const low = m.stock <= m.min_stock;
            return (
              <div key={m.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted tabular-nums">{t("mat.minStock")}: {nf.format(m.min_stock)} {m.unit} · {formatMoney(m.unit_cost_cents, locale)} / {m.unit}</div>
                  </div>
                  <span className={cx("text-lg font-semibold tabular-nums", low && "text-danger")}>{nf.format(m.stock)} {m.unit}</span>
                  {low && <span className="chip bg-danger-soft text-danger">{t("mat.low")}</span>}
                  <EditMaterial mat={m} />
                </div>
                <StockForm mat={m} />
              </div>
            );
          })}
          {!list.length && <EmptyState>{t("mat.none")}</EmptyState>}
        </section>
        <div className="space-y-4">
          <section className="card-white space-y-3 p-4">
            <h2 className="font-semibold">{t("mat.new")}</h2>
            <MaterialForm />
          </section>
          <section className="card-white space-y-2 p-4">
            <h2 className="font-semibold">{t("mat.history")}</h2>
            <ul className="space-y-1 text-sm">
              {(moves ?? []).map((mv) => (
                <li key={mv.id} className="flex flex-wrap gap-x-2 rounded-[10px] bg-card px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{matName(mv.material_id)} · {t(`mat.k_${mv.kind}`)}{mv.note ? ` · ${mv.note}` : ""}</span>
                  <span className={cx("tabular-nums", Number(mv.qty) < 0 ? "text-danger" : "text-ok")}>{Number(mv.qty) > 0 ? "+" : ""}{nf.format(Number(mv.qty))}</span>
                  <span className="w-full text-xs text-muted">
                    {formatDateTime(mv.created_at, locale)} · {members?.find((x) => x.id === mv.member_id)?.full_name ?? "—"}
                    {mv.task_id && <> · <Link className="text-link" href={`/boss/tasks/${mv.task_id}`}>→</Link></>}
                  </span>
                </li>
              ))}
              {!moves?.length && <li className="text-muted">—</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
