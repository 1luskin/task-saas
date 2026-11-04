"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteClient, saveClient } from "@/server/actions/clients";
import type { Client } from "@/lib/supabase/types";
import { Field, Input, Textarea } from "../ui";
import { useAction, ErrorText } from "../use-action";

export function ClientForm({ client }: { client?: Client }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({
    name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "", address: client?.address ?? "",
    notes: client?.notes ?? "", hide_price: client?.hide_price ?? false,
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveClient(client?.id ?? null, v), { onOk: (r) => { if (!client) router.push(`/boss/clients/${(r.data as { id: string }).id}`); } });
      }}
    >
      <Field label={t("clients.name")}><Input required maxLength={160} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={t("clients.email")}><Input type="email" maxLength={254} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label={t("clients.phone")}><Input type="tel" maxLength={40} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      <Field label={t("clients.address")}><Input maxLength={300} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
      <Field label={t("clients.notes")} className="sm:col-span-2"><Textarea maxLength={2000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      <label className="flex min-h-12 items-center gap-3 sm:col-span-2">
        <input type="checkbox" className="size-5" checked={v.hide_price} onChange={(e) => setV({ ...v, hide_price: e.target.checked })} />
        {t("clients.hidePrice")}
      </label>
      <ErrorText error={error} />
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
        {client && (
          <button type="button" className="btn-ghost text-danger" disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteClient(client.id), { onOk: () => router.push("/boss/clients"), refresh: false })}>
            {t("common.delete")}
          </button>
        )}
      </div>
    </form>
  );
}
