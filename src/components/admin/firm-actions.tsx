"use client";
import { useI18n } from "@/i18n/client";
import { extendTrial, setFirmPlan } from "@/server/actions/admin";
import { useAction } from "../use-action";

export function FirmActions({ firmId, plan }: { firmId: string; plan: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const b = "btn-secondary !min-h-9 !px-3 text-sm";
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={b} disabled={pending} onClick={() => run(() => extendTrial(firmId, 14))}>{t("admin.plus14")}</button>
      {plan === "blocked" ? (
        <button className={b} disabled={pending} onClick={() => run(() => setFirmPlan(firmId, "trial"))}>{t("admin.unblock")}</button>
      ) : (
        <button className={`${b} text-danger`} disabled={pending} onClick={() => confirm(t("common.confirmDelete")) && run(() => setFirmPlan(firmId, "blocked"))}>{t("admin.block")}</button>
      )}
      {plan !== "paid" && <button className={b} disabled={pending} onClick={() => run(() => setFirmPlan(firmId, "paid"))}>{t("admin.markPaid")}</button>}
    </div>
  );
}
