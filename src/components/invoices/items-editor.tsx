"use client";
import { useI18n } from "@/i18n/client";
import { invoiceTotals } from "@/lib/invoice-calc";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { Input, Select } from "../ui";
import { IconTrash } from "../icons";

export type ItemRow = { description: string; qty: string; unit: string; price: string; vat: 0 | 7 | 19 };

export function ItemsEditor({ items, onChange, smallBusiness, defaultVat }: { items: ItemRow[]; onChange: (v: ItemRow[]) => void; smallBusiness: boolean; defaultVat: 0 | 7 | 19 }) {
  const { t, locale } = useI18n();
  const set = (i: number, patch: Partial<ItemRow>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const tot = invoiceTotals(items.map((i) => ({
    description: i.description, unit: i.unit, vat_rate: i.vat,
    qty: Number(i.qty.replace(",", ".")) || 0, unit_price_cents: Number(parseMoneyToCents(i.price)) || 0,
  })), smallBusiness);
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem_7rem_5rem_6.5rem_2.5rem] gap-2 px-1 text-xs text-muted md:grid">
        <span>{t("inv.description")}</span><span>{t("inv.qty")}</span><span>{t("inv.unit")}</span><span>{t("inv.price")}</span><span>{t("inv.vat")}</span><span className="text-right">{t("inv.net")}</span><span />
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-[12px] bg-card p-2 md:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem_5rem_6.5rem_2.5rem] md:items-center md:bg-transparent md:p-0">
          <Input aria-label={t("inv.description")} className="col-span-2 md:col-span-1" required maxLength={500} value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
          <Input aria-label={t("inv.qty")} inputMode="decimal" required value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} />
          <Input aria-label={t("inv.unit")} required maxLength={20} value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} />
          <Input aria-label={t("inv.price")} inputMode="decimal" required placeholder="0,00" value={it.price} onChange={(e) => set(i, { price: e.target.value })} />
          <Select aria-label={t("inv.vat")} disabled={smallBusiness} value={String(it.vat)} onChange={(e) => set(i, { vat: Number(e.target.value) as 0 | 7 | 19 })}>
            <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option>
          </Select>
          <span className="self-center text-right tabular-nums">{formatMoney(tot.rows[i]?.net ?? 0, locale)}</span>
          <button type="button" className="btn-ghost !min-h-10 !px-2 text-muted" aria-label={t("inv.remove")} onClick={() => onChange(items.filter((_, j) => j !== i))}><IconTrash className="size-4" /></button>
        </div>
      ))}
      <button type="button" className="btn-secondary !min-h-10 text-sm" onClick={() => onChange([...items, { description: "", qty: "1", unit: "Stk", price: "", vat: defaultVat }])}>{t("inv.addItem")}</button>
      <dl className="ml-auto max-w-xs space-y-1 pt-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t("inv.net")}</dt><dd className="tabular-nums">{formatMoney(tot.net, locale)}</dd></div>
        {!smallBusiness && tot.groups.map((g) => <div key={g.rate} className="flex justify-between"><dt className="text-muted">{t("inv.vatSum")} {g.rate} %</dt><dd className="tabular-nums">{formatMoney(g.vat, locale)}</dd></div>)}
        <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>{t("inv.gross")}</dt><dd className="tabular-nums">{formatMoney(tot.gross, locale)}</dd></div>
      </dl>
    </div>
  );
}
