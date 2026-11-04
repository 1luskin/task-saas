"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Field, Input } from "@/components/ui";
import { requestCode, verifyCode, type LoginResult } from "@/server/actions/login";
import { Turnstile } from "@/components/turnstile";

export function LoginForm({ next, nonce }: { next: string; nonce?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (r: Exclude<LoginResult, { ok: true }>) =>
    r.error === "rate_limited" ? t("auth.rateLimited") : r.error === "wrong_code" ? t("auth.wrongCode") : r.error === "captcha" ? t("auth.captcha") : r.error === "invalid" ? t("common.invalid") : t("common.error");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await requestCode({ email, captcha });
    setBusy(false);
    if (!r.ok) return setError(message(r));
    setEmail(email.trim().toLowerCase());
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await verifyCode({ email, code });
    setBusy(false);
    if (!r.ok) return setError(message(r));
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
        <Input type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Turnstile onToken={setCaptcha} nonce={nonce} />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
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
          className="text-center text-2xl tracking-[0.4em] tabular-nums"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
      </Field>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button className="btn-primary btn-xl w-full" disabled={busy}>
        {busy ? t("common.loading") : t("auth.verify")}
      </button>
      <button type="button" className="btn-ghost w-full" onClick={() => setStep("email")}>
        {t("auth.otherEmail")}
      </button>
    </form>
  );
}
