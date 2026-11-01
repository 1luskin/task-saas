"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Field, Input } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { acceptInvite } from "@/server/actions/auth";

export function JoinForm({ token }: { token: string }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [fullName, setFullName] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => acceptInvite({ token, fullName }));
      }}
    >
      <Field label={t("join.yourName")}>
        <Input required maxLength={120} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      </Field>
      <ErrorText error={error} />
      <button className="btn-primary btn-xl w-full" disabled={pending}>
        {t("join.submit")}
      </button>
    </form>
  );
}
