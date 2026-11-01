"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Field, Input } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { createFirm } from "@/server/actions/auth";

export function OnboardingForm() {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [firmName, setFirmName] = useState("");
  const [fullName, setFullName] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createFirm({ firmName, fullName }));
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("onboarding.title")}</h1>
        <p className="mt-1 text-muted">{t("onboarding.intro")}</p>
      </div>
      <Field label={t("onboarding.firmName")}>
        <Input required maxLength={120} value={firmName} onChange={(e) => setFirmName(e.target.value)} />
      </Field>
      <Field label={t("onboarding.yourName")}>
        <Input required maxLength={120} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <ErrorText error={error} />
      <button className="btn-primary btn-xl w-full" disabled={pending}>
        {pending ? t("common.loading") : t("onboarding.submit")}
      </button>
      <p className="text-center text-sm text-muted">{t("onboarding.hasInvite")}</p>
    </form>
  );
}
