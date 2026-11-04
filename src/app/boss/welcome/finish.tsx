"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { finishOnboarding } from "@/server/actions/onboarding";

export function FinishOnboarding() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-primary btn-xl w-full"
      disabled={pending}
      onClick={() => start(async () => { await finishOnboarding(); router.push("/boss"); })}
    >
      {t("onboarding2.done")}
    </button>
  );
}
