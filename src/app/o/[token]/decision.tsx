"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { decideOfferPublic } from "@/server/actions/invoices";
import { Field, Input } from "@/components/ui";
import { useAction, ErrorText } from "@/components/use-action";

export function OfferDecision({ token }: { token: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  if (done) return <p className="card-white p-4 text-center">{t(`offerPublic.${done}`)}</p>;
  return (
    <form className="card-white space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); run(() => decideOfferPublic(token, true, name), { onOk: () => setDone("accepted"), messages: { offer_closed: t("offerPublic.closed") } }); }}>
      <Field label={t("offerPublic.yourName")}><Input required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" required className="size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />{t("offerPublic.confirm")}</label>
      <ErrorText error={error} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1" disabled={pending || !ok || !name.trim()}>{t("offerPublic.accept")}</button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => confirm(t("offerPublic.decline") + "?") && run(() => decideOfferPublic(token, false, name), { onOk: () => setDone("declined") })}>{t("offerPublic.decline")}</button>
      </div>
    </form>
  );
}
