"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = z.string().trim().toLowerCase().email().safeParse(email);
    if (!parsed.success) return setError(t("common.invalid"));
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(error.message);
    setEmail(parsed.data);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return setError(t("auth.wrongCode"));
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setError(t("auth.wrongCode"));
    router.replace(next);
    router.refresh();
  }

  return step === "email" ? (
    <form onSubmit={sendCode} className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-muted">{t("auth.loginIntro")}</p>
      </div>
      <Field label={t("auth.email")}>
        <Input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary btn-xl w-full" disabled={busy}>
        {busy ? t("common.loading") : t("auth.sendCode")}
      </button>
      <p className="text-center text-sm text-muted">{t("auth.registerHint")}</p>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-muted">{t("auth.codeSent", { email })}</p>
      <Field label={t("auth.code")}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          className="text-center text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary btn-xl w-full" disabled={busy}>
        {busy ? t("common.loading") : t("auth.verify")}
      </button>
      <button type="button" className="btn-ghost w-full" onClick={() => setStep("email")}>
        {t("auth.otherEmail")}
      </button>
    </form>
  );
}
