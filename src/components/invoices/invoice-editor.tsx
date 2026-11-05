"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cancelInvoice, deleteInvoiceDraft, emailInvoice, issueInvoice, saveInvoiceDraft, setInvoicePaid } from "@/server/actions/invoices";
import { centsToInput } from "@/lib/money";
import type { Invoice, InvoiceItem } from "@/lib/supabase/types";
import { Field, Input, Textarea } from "../ui";
import { useAction, ErrorText } from "../use-action";
import { ItemsEditor, type ItemRow } from "./items-editor";

export function useInvoiceMessages() {
  const { t } = useI18n();
  return Object.fromEntries((["seller_incomplete", "buyer_incomplete", "service_date", "no_items", "invoice_locked", "cannot_cancel"] as const).map((k) => [k, t(`inv.e_${k}`)]));
}

export function InvoiceEditor({ inv, items, smallBusiness, defaultVat }: { inv: Invoice; items: InvoiceItem[]; smallBusiness: boolean; defaultVat: 0 | 7 | 19 }) {
  const { t } = useI18n();
  const router = useRouter();
  const messages = useInvoiceMessages();
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState({
    buyer_name: inv.buyer_name, buyer_street: inv.buyer_street ?? "", buyer_zip: inv.buyer_zip ?? "", buyer_city: inv.buyer_city ?? "", buyer_country: inv.buyer_country,
    buyer_vat_id: inv.buyer_vat_id ?? "", buyer_email: inv.buyer_email ?? "", buyer_reference: inv.buyer_reference ?? "",
    service_date: inv.service_date ?? "", service_date_to: inv.service_date_to ?? "", issue_date: inv.issue_date ?? "", due_date: inv.due_date ?? "", note: inv.note ?? "",
  });
  const [rows, setRows] = useState<ItemRow[]>(items.map((i) => ({ description: i.description, qty: String(Number(i.qty)).replace(".", ","), unit: i.unit, price: centsToInput(i.unit_price_cents), vat: i.vat_rate })));
  const f = (k: keyof typeof v, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><Input value={v[k]} onChange={(e) => { setSaved(false); setV({ ...v, [k]: e.target.value }); }} {...props} /></Field>
  );
  const save = () => saveInvoiceDraft(inv.id, { ...v, items: rows });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(save, { onOk: () => setSaved(true), messages }); }}>
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("inv.buyer")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {f("buyer_name", t("inv.name"), { required: true, maxLength: 160 })}
          {f("buyer_email", t("inv.email"), { type: "email", maxLength: 254 })}
          {f("buyer_street", t("inv.street"), { maxLength: 160 })}
          <div className="grid grid-cols-[6rem_1fr_4.5rem] gap-2">
            {f("buyer_zip", t("inv.zip"), { maxLength: 10 })}
            {f("buyer_city", t("inv.city"), { maxLength: 80 })}
            {f("buyer_country", t("inv.country"), { maxLength: 2, pattern: "[A-Z]{2}" })}
          </div>
          {f("buyer_vat_id", t("inv.vatId"), { maxLength: 20 })}
          {f("buyer_reference", t("inv.reference"), { maxLength: 100 })}
        </div>
      </section>
      <section className="card-white grid gap-3 p-4 sm:grid-cols-4">
        {f("service_date", t("inv.serviceDate"), { type: "date" })}
        {f("service_date_to", t("inv.serviceTo"), { type: "date" })}
        {f("issue_date", t("inv.issueDate"), { type: "date" })}
        {f("due_date", t("inv.dueDate"), { type: "date" })}
      </section>
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("inv.items")}</h2>
        <ItemsEditor items={rows} onChange={(r) => { setSaved(false); setRows(r); }} smallBusiness={smallBusiness} defaultVat={defaultVat} />
        <Field label={t("inv.note")}><Textarea maxLength={2000} rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </section>
      <ErrorText error={error} />
      {saved && !error && <p className="text-sm text-ok">{t("common.saved")}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={pending}>{t("inv.save")}</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={() => {
          if (!confirm(t("inv.issueConfirm"))) return;
          run(async () => { const r = await save(); return r.ok ? issueInvoice(inv.id) : r; }, { messages });
        }}>{t("inv.issue")}</button>
        <a className="btn-ghost" href={`/api/invoices/${inv.id}/pdf`}>{t("inv.pdf")}</a>
        <button type="button" className="btn-ghost text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteInvoiceDraft(inv.id), { onOk: () => router.push("/boss/invoices"), refresh: false })}>{t("common.delete")}</button>
      </div>
    </form>
  );
}

export function IssuedActions({ inv }: { inv: Invoice }) {
  const { t } = useI18n();
  const router = useRouter();
  const messages = useInvoiceMessages();
  const { run, pending, error } = useAction();
  const [mailed, setMailed] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary" href={`/api/invoices/${inv.id}/pdf`}>{t("inv.pdf")}</a>
        <a className="btn-secondary" href={`/api/invoices/${inv.id}/xml`}>{t("inv.xml")}</a>
        {inv.buyer_email && <button className="btn-secondary" disabled={pending} onClick={() => run(() => emailInvoice(inv.id), { onOk: () => setMailed(true), refresh: false })}>{t("inv.sendMail")}</button>}
        {inv.kind === "invoice" && inv.status === "sent" && <button className="btn-secondary" disabled={pending} onClick={() => run(() => setInvoicePaid(inv.id, true))}>{t("inv.markPaid")}</button>}
        {inv.kind === "invoice" && inv.status === "paid" && <button className="btn-ghost" disabled={pending} onClick={() => run(() => setInvoicePaid(inv.id, false))}>{t("inv.markUnpaid")}</button>}
        {inv.kind === "invoice" && (inv.status === "sent" || inv.status === "paid") && (
          <button className="btn-ghost text-danger" disabled={pending} onClick={() => {
            if (!confirm(t("inv.cancelConfirm"))) return;
            const reason = prompt(t("inv.cancelReason")) ?? "";
            run(() => cancelInvoice(inv.id, reason), { onOk: (r) => router.push(`/boss/invoices/${(r.data as { id: string }).id}`), messages });
          }}>{t("inv.cancel")}</button>
        )}
      </div>
      {mailed && <p className="text-sm text-ok">{t("inv.mailed")}</p>}
      <ErrorText error={error} />
    </div>
  );
}
