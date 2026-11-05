"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { adjustStock, archiveMaterial, saveMaterial, useMaterial as consumeMaterial } from "@/server/actions/materials";
import { centsToInput } from "@/lib/money";
import { Field, Input, Select } from "../ui";
import { useAction, ErrorText } from "../use-action";

type Mat = { id: string; name: string; unit: string; stock: number; min_stock: number; unit_cost_cents: number };
const fmtQty = (n: number, locale: string) => new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE", { maximumFractionDigits: 3 }).format(n);

export function MaterialForm({ mat, onDone }: { mat?: Mat; onDone?: () => void }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const empty = { name: "", unit: "Stk", minStock: "0", unitCost: "", stock: "" };
  const [v, setV] = useState(mat ? { name: mat.name, unit: mat.unit, minStock: String(mat.min_stock).replace(".", ","), unitCost: centsToInput(mat.unit_cost_cents), stock: "" } : empty);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveMaterial(mat?.id ?? null, v), { onOk: () => { if (!mat) setV(empty); onDone?.(); } }); }}>
      <Field label={t("mat.name")} className="sm:col-span-2"><Input required maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={t("mat.unit")}><Input required maxLength={20} value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} /></Field>
      <Field label={t("mat.minStock")}><Input inputMode="decimal" value={v.minStock} onChange={(e) => setV({ ...v, minStock: e.target.value })} /></Field>
      <Field label={t("mat.unitCost")}><Input inputMode="decimal" placeholder="0,00" value={v.unitCost} onChange={(e) => setV({ ...v, unitCost: e.target.value })} /></Field>
      {!mat && <Field label={t("mat.startStock")}><Input inputMode="decimal" value={v.stock} onChange={(e) => setV({ ...v, stock: e.target.value })} /></Field>}
      <ErrorText error={error} />
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
        {mat && <button type="button" className="btn-ghost text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => archiveMaterial(mat.id))}>{t("mat.archive")}</button>}
      </div>
    </form>
  );
}

export function StockForm({ mat }: { mat: Mat }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ kind: "in" as "in" | "correction", qty: "", unitCost: "", note: "" });
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => adjustStock({ id: mat.id, ...v }), { onOk: () => setV({ ...v, qty: "", unitCost: "", note: "" }) }); }}>
      <Select aria-label={t("mat.in")} className="!min-h-10 !w-auto" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "in" | "correction" })}>
        <option value="in">{t("mat.in")}</option><option value="correction">{t("mat.correction")}</option>
      </Select>
      <Input aria-label={t("mat.qty")} inputMode="decimal" required placeholder={v.kind === "in" ? "+10" : "-2"} className="!min-h-10 w-24" value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value })} />
      {v.kind === "in" && <Input aria-label={t("mat.unitCost")} inputMode="decimal" placeholder={`${centsToInput(mat.unit_cost_cents)} €`} className="!min-h-10 w-28" value={v.unitCost} onChange={(e) => setV({ ...v, unitCost: e.target.value })} />}
      <Input aria-label={t("mat.note")} placeholder={t("mat.note")} maxLength={300} className="!min-h-10 min-w-0 flex-1" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
      <button className="btn-secondary !min-h-10" disabled={pending}>{t("mat.book")}</button>
      <ErrorText error={error} />
    </form>
  );
}

export function EditMaterial({ mat }: { mat: Mat }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return open ? <div className="rounded-[12px] bg-card p-3"><MaterialForm mat={mat} onDone={() => setOpen(false)} /></div>
    : <button className="btn-ghost !min-h-9 !px-2 text-sm text-link" onClick={() => setOpen(true)}>{t("common.edit")}</button>;
}

/** In der Aufgabe: Material entnehmen (geht als Ausgabe in die Aufgabe) */
export function UseMaterial({ taskId, materials }: { taskId: string; materials: Mat[] }) {
  const { t, locale } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ materialId: "", qty: "1" });
  const sel = materials.find((m) => m.id === v.materialId);
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      run(() => consumeMaterial({ taskId, ...v }), { onOk: () => setV({ materialId: "", qty: "1" }), messages: { insufficient_stock: t("mat.insufficient") } });
    }}>
      <Field label={t("mat.use")}>
        <Select required value={v.materialId} onChange={(e) => setV({ ...v, materialId: e.target.value })}>
          <option value="">—</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({fmtQty(m.stock, locale)} {m.unit})</option>)}
        </Select>
      </Field>
      <Field label={`${t("mat.qty")}${sel ? ` (${sel.unit})` : ""}`}><Input inputMode="decimal" required value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value })} /></Field>
      <button className="btn-secondary" disabled={pending || !v.materialId}>{t("mat.book")}</button>
      <div className="sm:col-span-3"><ErrorText error={error} /></div>
    </form>
  );
}
