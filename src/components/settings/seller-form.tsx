"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { saveSellerData } from "@/server/actions/invoices";
import type { Firm } from "@/lib/supabase/types";
import { Field, Input } from "../ui";
import { useAction, ErrorText } from "../use-action";

type K = "legal_name" | "address_street" | "address_zip" | "address_city" | "address_country" | "tax_number" | "vat_id" | "iban" | "bic" | "bank_name" | "invoice_email" | "invoice_phone" | "invoice_prefix";

export function SellerForm({ firm }: { firm: Pick<Firm, K | "payment_terms_days"> }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [ok, setOk] = useState(false);
  const keys: K[] = ["legal_name", "address_street", "address_zip", "address_city", "address_country", "tax_number", "vat_id", "iban", "bic", "bank_name", "invoice_email", "invoice_phone", "invoice_prefix"];
  const [v, setV] = useState<Record<K, string> & { terms: string }>({ ...(Object.fromEntries(keys.map((k) => [k, firm[k] ?? ""])) as Record<K, string>), terms: String(firm.payment_terms_days) });
  const label: Record<K, string> = {
    legal_name: t("inv.legalName"), address_street: t("inv.street"), address_zip: t("inv.zip"), address_city: t("inv.city"), address_country: t("inv.country"),
    tax_number: t("inv.taxNumber"), vat_id: t("inv.vatId").replace(/\s*\(.*\)/, ""), iban: t("inv.iban"), bic: t("inv.bic"), bank_name: t("inv.bank"),
    invoice_email: t("inv.invEmail"), invoice_phone: t("inv.invPhone"), invoice_prefix: t("inv.prefix"),
  };
  return (
    <form id="invoice-data" className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setOk(false);
      const { terms, ...rest } = v;
      run(() => saveSellerData({ ...rest, payment_terms_days: Number(terms) || 0 }), { onOk: () => setOk(true) });
    }}>
      <h2 className="font-semibold">{t("inv.sellerTitle")}</h2>
      <p className="text-sm text-muted">{t("inv.sellerHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <Field key={k} label={label[k]} className={k === "legal_name" ? "sm:col-span-2" : undefined}>
            <Input value={v[k]} maxLength={k === "address_country" ? 2 : 160} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label={t("inv.terms")}><Input type="number" min={0} max={120} value={v.terms} onChange={(e) => setV({ ...v, terms: e.target.value })} /></Field>
      </div>
      <ErrorText error={error} />
      {ok && <p className="text-sm text-ok">{t("common.saved")}</p>}
      <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
    </form>
  );
}
