"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { updateFirm } from "@/server/actions/members";
import { Field, Input } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";

export function FirmForm({ name }: { name: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [v, setV] = useState(name);
  const [saved, setSaved] = useState(false);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateFirm({ name: v }), { onOk: () => setSaved(true) }); }}>
      <Field label={t("settings.firmName")} className="min-w-0 flex-1">
        <Input value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} required maxLength={120} />
      </Field>
      <button className="btn-primary" disabled={pending}>{saved ? t("common.saved") : t("common.save")}</button>
      <ErrorText error={error} />
    </form>
  );
}
