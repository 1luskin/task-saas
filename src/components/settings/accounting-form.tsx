"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { saveAccounting } from "@/server/actions/settings";
import { DEFAULT_ACCOUNTS } from "@/lib/datev";
import type { DatevAccounts } from "@/lib/supabase/types";
import { Field, Input, Select } from "../ui";
import { useAction, ErrorText } from "../use-action";

type Init = { consultantNo: number | null; clientNo: number | null; skr: "03" | "04"; vatRate: 0 | 7 | 19; smallBusiness: boolean; accounts: DatevAccounts };
const KEYS = ["debitor", "cash", "expense", "material"] as const;

export function AccountingForm({ initial }: { initial: Init }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [ok, setOk] = useState(false);
  const [v, setV] = useState({
    consultantNo: initial.consultantNo?.toString() ?? "", clientNo: initial.clientNo?.toString() ?? "", skr: initial.skr,
    vatRate: String(initial.vatRate), smallBusiness: initial.smallBusiness,
    accounts: Object.fromEntries(KEYS.map((k) => [k, initial.accounts[k]?.toString() ?? ""])) as Record<(typeof KEYS)[number], string>,
  });
  const num = (s: string) => (s.trim() ? Number(s) : null);
  return (
    <form id="datev" className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setOk(false);
      run(() => saveAccounting({
        consultantNo: num(v.consultantNo), clientNo: num(v.clientNo), skr: v.skr, vatRate: Number(v.vatRate) as 0 | 7 | 19, smallBusiness: v.smallBusiness,
        accounts: Object.fromEntries(KEYS.map((k) => [k, num(v.accounts[k])])),
      }), { onOk: () => setOk(true) });
    }}>
      <h2 className="font-semibold">{t("acc.title")}</h2>
      <p className="text-sm text-muted">{t("acc.hint")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("acc.consultant")}><Input inputMode="numeric" pattern="[0-9]*" maxLength={7} value={v.consultantNo} onChange={(e) => setV({ ...v, consultantNo: e.target.value })} /></Field>
        <Field label={t("acc.client")}><Input inputMode="numeric" pattern="[0-9]*" maxLength={5} value={v.clientNo} onChange={(e) => setV({ ...v, clientNo: e.target.value })} /></Field>
        <Field label={t("acc.skr")}>
          <Select value={v.skr} onChange={(e) => setV({ ...v, skr: e.target.value as "03" | "04" })}><option value="03">SKR 03</option><option value="04">SKR 04</option></Select>
        </Field>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="size-5" checked={v.smallBusiness} onChange={(e) => setV({ ...v, smallBusiness: e.target.checked })} />
        {t("acc.smallBusiness")}
      </label>
      {!v.smallBusiness && (
        <Field label={t("acc.vat")}>
          <Select value={v.vatRate} onChange={(e) => setV({ ...v, vatRate: e.target.value })}>
            <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option>
          </Select>
        </Field>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-link">{t("acc.accounts")}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {KEYS.map((k) => (
            <Field key={k} label={t(`acc.a_${k}`)}>
              <Input inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder={String(DEFAULT_ACCOUNTS[v.skr][k])} value={v.accounts[k]}
                onChange={(e) => setV({ ...v, accounts: { ...v.accounts, [k]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </details>
      <ErrorText error={error} />
      {ok && <p className="text-sm text-ok">{t("common.saved")}</p>}
      <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
    </form>
  );
}
