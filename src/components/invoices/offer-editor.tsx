"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { createInvoice, createOffer, deleteOffer, saveOfferDraft, sendOffer } from "@/server/actions/invoices";
import { centsToInput } from "@/lib/money";
import type { Offer, OfferItem } from "@/lib/supabase/types";
import { Field, Input, Textarea } from "../ui";
import { useAction, ErrorText } from "../use-action";
import { ItemsEditor, type ItemRow } from "./items-editor";
import { useInvoiceMessages } from "./invoice-editor";

export function OfferEditor({ off, items, smallBusiness, defaultVat }: { off: Offer; items: OfferItem[]; smallBusiness: boolean; defaultVat: 0 | 7 | 19 }) {
  const { t } = useI18n();
  const router = useRouter();
  const messages = useInvoiceMessages();
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState({ title: off.title, intro: off.intro ?? "", buyer_name: off.buyer_name, buyer_email: off.buyer_email ?? "", buyer_address: off.buyer_address ?? "", valid_until: off.valid_until ?? "" });
  const [rows, setRows] = useState<ItemRow[]>(items.map((i) => ({ description: i.description, qty: String(Number(i.qty)).replace(".", ","), unit: i.unit, price: centsToInput(i.unit_price_cents), vat: i.vat_rate })));
  const save = () => saveOfferDraft(off.id, { ...v, items: rows });
  const input = (k: keyof typeof v, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><Input value={v[k]} onChange={(e) => { setSaved(false); setV({ ...v, [k]: e.target.value }); }} {...props} /></Field>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(save, { onOk: () => setSaved(true), messages }); }}>
      <section className="card-white grid gap-3 p-4 sm:grid-cols-2">
        {input("title", t("inv.offerTitle"), { required: true, maxLength: 200 })}
        {input("valid_until", t("inv.validUntil"), { type: "date" })}
        {input("buyer_name", t("inv.name"), { required: true, maxLength: 160 })}
        {input("buyer_email", t("inv.email"), { type: "email", maxLength: 254 })}
        <div className="sm:col-span-2">{input("buyer_address", t("inv.address"), { maxLength: 300 })}</div>
        <Field label={t("inv.intro")} className="sm:col-span-2"><Textarea rows={2} maxLength={3000} value={v.intro} onChange={(e) => setV({ ...v, intro: e.target.value })} /></Field>
      </section>
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("inv.items")}</h2>
        <ItemsEditor items={rows} onChange={(r) => { setSaved(false); setRows(r); }} smallBusiness={smallBusiness} defaultVat={defaultVat} />
      </section>
      <ErrorText error={error} />
      {saved && !error && <p className="text-sm text-ok">{t("common.saved")}</p>}
      <p className="text-sm text-muted">{t("inv.sendOfferHint")}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={pending}>{t("inv.save")}</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(async () => { const r = await save(); return r.ok ? sendOffer(off.id) : r; }, { messages })}>{t("inv.sendOffer")}</button>
        <a className="btn-ghost" href={`/api/offers/${off.id}/pdf`}>{t("inv.pdf")}</a>
        <button type="button" className="btn-ghost text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteOffer(off.id), { onOk: () => router.push("/boss/invoices?tab=offers"), refresh: false })}>{t("common.delete")}</button>
      </div>
    </form>
  );
}

export function OfferToInvoice({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <>
      <button className="btn-primary" disabled={pending} onClick={() => run(() => createInvoice({ offerId }), { onOk: (r) => router.push(`/boss/invoices/${(r.data as { id: string }).id}`), refresh: false })}>{t("inv.toInvoice")}</button>
      <ErrorText error={error} />
    </>
  );
}

export function NewDocButton({ kind, taskId, clientId, label, className }: { kind: "invoice" | "offer"; taskId?: string; clientId?: string; label: string; className?: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <>
      <button className={className ?? "btn-primary"} disabled={pending} onClick={() => run(
        () => (kind === "invoice" ? createInvoice({ taskId: taskId ?? null, clientId: clientId ?? null }) : createOffer({ clientId: clientId ?? null })),
        { onOk: (r) => router.push(`/boss/${kind === "invoice" ? "invoices" : "offers"}/${(r.data as { id: string }).id}`), refresh: false },
      )}>{label}</button>
      <ErrorText error={error} />
    </>
  );
}
